'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { useSuppliers } from '@/components/modules/purchases/purchase-catalog'
import PurchaseOrderLineItemsTable from '@/components/modules/purchases/purchase-order-line-items-table'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const generateOrderNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `PO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// Converting an approved Purchase Request into a Purchase Order does
// NOT create the order directly - it hands the request's items +
// needed-by date over to this same "New Purchase Order" form via
// ?fromRequest=<requestId>, so whoever is authorizing the order still
// picks the supplier and writes their own notes. Deliberately NOT
// carried over: notes (the request's notes are internal context for
// colleagues; PO notes go out to the supplier and should be written
// fresh by whoever is converting it) and supplier (never set on a
// request in the first place).
//
// Title vs order number: 'title' is a person-entered name, distinct
// from order_number (the auto-generated, immutable PO-xxxxxx-XXXX
// identifier) - same split as on Purchase Requests. The draft row's
// own 'title' column holds this real title; the generated number
// travels inside the draft payload instead.
export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const initialFromRequestId = searchParams.get('fromRequest')
  // A merge (2+ approved requests combined into one order) arrives via
  // ?fromRequests=id1,id2,... instead - distinct from the single-request
  // ?fromRequest=<id> conversion above. Parsed once on mount; after that
  // the loaded sourceRequestIds state is what matters (same reasoning as
  // initialFromRequestId not being re-read after mount).
  const initialFromRequestIds = useMemo(() => {
    const raw = searchParams.get('fromRequests')
    return raw ? raw.split(',').map((id) => id.trim()).filter(Boolean) : []
  }, [searchParams])

  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  const [title, setTitle] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [draftId, setDraftId] = useState(draftParam || null)
  const [supplierId, setSupplierId] = useState('')
  // No separate "requested by" concept here - purchase_orders.created_by
  // already records who made the order, auto-filled from the session,
  // same as the request form's requested_by.
  const [currentUser, setCurrentUser] = useState(null)
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([
    { variantId: '', qty: 1, standardCostPrice: 0, unitCost: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [sourceRequestId, setSourceRequestId] = useState(initialFromRequestId || '')
  const [sourceRequestLoading, setSourceRequestLoading] = useState(
    Boolean(initialFromRequestId || initialFromRequestIds.length > 0 || draftParam)
  )
  const [sourceRequestNumber, setSourceRequestNumber] = useState('')
  // Merge source requests - mutually exclusive with sourceRequestId
  // above. Only one of the two is ever populated: a single conversion
  // uses sourceRequestId/source_request (and carries that request's own
  // code), a merge uses these arrays + the join table instead (and gets
  // its own freshly generated code).
  const [sourceRequestIds, setSourceRequestIds] = useState(initialFromRequestIds)
  const [sourceRequestNumbers, setSourceRequestNumbers] = useState([])
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))

  const { suppliers, loading: suppliersLoading } = useSuppliers(companyId)
  const { catalog, currencies, loading: catalogLoading, error: catalogError } =
    useRequestCatalog(branchId)
  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  // Which currencies this branch actually allows, and the rate for
  // each - assumed convention: rate = how many units of the branch's
  // own base_currency equal 1 unit of that currency (the one confirmed
  // example is the base currency itself carrying rate: 1, which is
  // consistent with either direction, so this direction should be
  // double-checked against a real non-base entry before trusting this
  // in production - getting it backwards would silently invert every
  // converted cost).
  const allowedCurrencies = currentBranch?.currencies || {}
  const allowedCurrencyCodes = Object.keys(allowedCurrencies)

  // Pricing a document in anything other than the branch's base
  // currency, or manually filling in a rate the branch doesn't have on
  // file, both require the same permission - see
  // purchase-override-pricing-permission-migration.sql
  // ('override_currency' - purchases' own name for this; Sales will
  // get its own 'override_price' key later, not this one). UI-level
  // check only; the actual insert is still just purchase_orders:create,
  // which is already enforced server-side.
  const [canOverrideCurrency, setCanOverrideCurrency] = useState(false)
  // The currency this ORDER is priced in - defaults to the branch's
  // base currency, only changeable by someone with override_currency,
  // and only ever to one of the branch's own allowed currencies (never
  // freeform).
  const [orderCurrency, setOrderCurrency] = useState(branchCurrencyCode)
  // Document-scoped manual rates for a currency the branch has no rate
  // for on file - keyed by currency code, {code: rateString}. These
  // are NOT written back to the branch's own currencies config; they
  // only apply to this one order.
  const [manualRates, setManualRates] = useState({})

  useEffect(() => {
    if (!orderCurrency && branchCurrencyCode) setOrderCurrency(branchCurrencyCode)
  }, [branchCurrencyCode, orderCurrency])

  useEffect(() => {
    let cancelled = false

    async function checkPermission() {
      if (!branchId) return
      const { data, error } = await supabase.rpc('can_access_purchase_order_resource', {
        p_branch: branchId,
        p_verb: 'override_currency',
      })
      if (!cancelled) setCanOverrideCurrency(!error && data === true)
    }

    checkPermission()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const getRate = (code) => {
    if (!code) return undefined
    if (allowedCurrencies[code]?.rate != null) return Number(allowedCurrencies[code].rate)
    if (manualRates[code] !== undefined && manualRates[code] !== '') return Number(manualRates[code])
    return undefined
  }

  // Converts an amount from one currency to another by pivoting through
  // the branch's base currency, using whatever rate each side resolves
  // to (branch-configured, or a manual override for this document).
  // Returns null when either side can't be resolved at all.
  const convertAmount = (amount, fromCode, toCode) => {
    if (!fromCode || fromCode === toCode) return Number(amount || 0)
    const rFrom = getRate(fromCode)
    const rTo = getRate(toCode)
    if (rFrom == null || rTo == null) return null
    return (Number(amount || 0) * rFrom) / rTo
  }

  // Every new order - blank, converted from a single request, or
  // merged from several - gets its OWN fresh generated code. Converting
  // no longer carries over the source request's own reference code
  // (that was the old design); traceability back to the request is
  // kept instead by the "converted from PR-xxx" label shown next to
  // the title, not by reusing its code. Skipped only when loading an
  // existing draft, whose orderNumber was already generated once and
  // is stored in its payload - reopening a draft must never change it.
  useEffect(() => {
    if (!draftParam) setOrderNumber(generateOrderNumber())
  }, [draftParam])

  // Title defaults to - and stays in sync with - the order number,
  // unless the person has actually typed their own title. This is
  // what the title input's onChange below flips once they start
  // typing, and what gets persisted in the draft payload so reopening
  // a draft doesn't lose the distinction between "never customized"
  // and "customized to this exact text".
  const [titleIsCustom, setTitleIsCustom] = useState(false)
  useEffect(() => {
    if (!titleIsCustom && orderNumber) setTitle(orderNumber)
  }, [orderNumber, titleIsCustom])

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled || error || !data?.user) return
      setCurrentUser(data.user)
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDraft() {
      if (!draftParam) return
      setDraftLoading(true)

      const { data, error } = await supabase
        .from('purchase_order_drafts')
        .select('id, title, payload')
        .eq('id', draftParam)
        .eq('branch', branchId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setSubmitError('Could not load this purchase order draft - it may have been deleted.')
        setDraftLoading(false)
        setSourceRequestLoading(false)
        return
      }

      const payload = data.payload || {}
      // Restore whether the title was ever customized BEFORE restoring
      // the title/order number themselves, so the sync effect above
      // doesn't clobber a genuinely custom title on reload, and does
      // correctly resync an auto one if it somehow drifted.
      setTitleIsCustom(Boolean(payload.titleIsCustom))
      setTitle(payload.titleIsCustom ? (data.title || '') : (payload.orderNumber || ''))
      setOrderNumber(payload.orderNumber || generateOrderNumber())
      setSupplierId(payload.supplierId || '')
      setNeededBy(payload.neededBy || '')
      setNotes(payload.notes || '')
      setItems(Array.isArray(payload.items) && payload.items.length > 0
        ? payload.items
        : [{ variantId: '', qty: 1, standardCostPrice: 0, unitCost: 0 }])
      setSourceRequestId(payload.sourceRequestId || '')
      setSourceRequestNumber(payload.sourceRequestNumber || '')
      setSourceRequestIds(Array.isArray(payload.sourceRequestIds) ? payload.sourceRequestIds : [])
      setSourceRequestNumbers(Array.isArray(payload.sourceRequestNumbers) ? payload.sourceRequestNumbers : [])
      setOrderCurrency(payload.orderCurrency || branchCurrencyCode)
      setManualRates(payload.manualRates && typeof payload.manualRates === 'object' ? payload.manualRates : {})
      setDraftId(data.id)
      setDraftLoading(false)
      setSourceRequestLoading(false)
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftParam, branchId])

  // Pull in the source request's items + needed-by date when converting
  // from one. Only runs when ?fromRequest=<id> is present. The request
  // must still be 'approved' - the same guard the convert button on the
  // detail page relies on - otherwise this surfaces an error rather than
  // silently falling back to a blank order.
  useEffect(() => {
    let cancelled = false

    async function loadSourceRequest() {
      if (!sourceRequestId || draftParam) return
      setSourceRequestLoading(true)

      try {
        const { data: requestRow, error: requestError } = await supabase
          .from('purchase_requests')
          .select('id, request_number, needed_by, status')
          .eq('id', sourceRequestId)
          .eq('branch', branchId)
          .maybeSingle()

        if (requestError) throw requestError
        if (!requestRow) throw new Error('That purchase request could not be found.')
        if (requestRow.status !== 'approved') {
          throw new Error('That purchase request is no longer approved - it may have already been converted.')
        }

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_request_line_items')
          .select('variant, quantity_requested, estimated_unit_cost')
          .eq('purchase_request', sourceRequestId)

        if (lineError) throw lineError
        if (cancelled) return

        setSourceRequestNumber(requestRow.request_number || '')
        // Order number is NOT carried over from the request (see the
        // mount effect above) - this order gets its own fresh code.
        // Title isn't seeded from the request either: purchase_requests
        // has no title column of its own (it's identified only by
        // request_number), and the order's title already defaults to
        // its own order number via the sync effect above.
        setNeededBy(requestRow.needed_by || '')
        if ((lineRows || []).length > 0) {
          setItems(
            lineRows.map((row) => ({
              variantId: row.variant,
              qty: row.quantity_requested,
              standardCostPrice: 0,
              unitCost: row.estimated_unit_cost || 0,
            }))
          )
        }
      } catch (err) {
        console.error('Failed to load source purchase request:', err)
        if (!cancelled) setSubmitError(err.message || 'Could not load the source purchase request.')
      } finally {
        if (!cancelled) setSourceRequestLoading(false)
      }
    }

    loadSourceRequest()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRequestId, branchId, draftParam])

  // Merge path: pull in every selected request's items, keep the
  // order's own freshly generated code (not carried from any one of
  // them - see generateOrderNumber() above), and pick the EARLIEST
  // needed-by date among them as a sensible default (the soonest
  // deadline governs when the merged order should ship). Every request
  // must still be 'approved' and in this same branch - the branch check
  // is redundant with the .eq('branch', branchId) below and the
  // database-level trigger on purchase_order_source_requests, but
  // surfacing it here as a clear error is friendlier than a silent RLS
  // failure on submit.
  useEffect(() => {
    let cancelled = false

    async function loadMergeSourceRequests() {
      if (sourceRequestIds.length === 0 || draftParam) return
      setSourceRequestLoading(true)

      try {
        const { data: requestRows, error: requestError } = await supabase
          .from('purchase_requests')
          .select('id, request_number, needed_by, status')
          .in('id', sourceRequestIds)
          .eq('branch', branchId)

        if (requestError) throw requestError
        if (!requestRows || requestRows.length !== sourceRequestIds.length) {
          throw new Error('One or more selected purchase requests could not be found in this branch.')
        }
        const notApproved = requestRows.filter((row) => row.status !== 'approved')
        if (notApproved.length > 0) {
          throw new Error('Every selected purchase request must still be approved - one or more has since changed.')
        }

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_request_line_items')
          .select('variant, quantity_requested, estimated_unit_cost')
          .in('purchase_request', sourceRequestIds)

        if (lineError) throw lineError
        if (cancelled) return

        setSourceRequestNumbers(requestRows.map((row) => row.request_number).filter(Boolean))

        const earliestNeededBy = requestRows
          .map((row) => row.needed_by)
          .filter(Boolean)
          .sort()[0]
        if (earliestNeededBy) setNeededBy(earliestNeededBy)

        if ((lineRows || []).length > 0) {
          setItems(
            lineRows.map((row) => ({
              variantId: row.variant,
              qty: row.quantity_requested,
              standardCostPrice: 0,
              unitCost: row.estimated_unit_cost || 0,
            }))
          )
        }
      } catch (err) {
        console.error('Failed to load source purchase requests for merge:', err)
        if (!cancelled) setSubmitError(err.message || 'Could not load the selected purchase requests.')
      } finally {
        if (!cancelled) setSourceRequestLoading(false)
      }
    }

    loadMergeSourceRequests()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRequestIds, branchId, draftParam])

  const createdByLabel =
    currentUser?.user_metadata?.full_name || currentUser?.email || 'You'

  // Each item's cost is entered in its own product's cost_currency
  // (unchanged - that input never changes), then converted into
  // orderCurrency for what actually gets totaled, displayed, and
  // eventually saved. resolved is null for an item whose currency has
  // no usable rate (branch-configured or manually entered) - those are
  // the ones that block submission below.
  const resolvedItems = useMemo(
    () => items.map((item) => {
      const variant = catalog.find((entry) => entry.id === item.variantId)
      const fromCode = variant?.cost_currency || branchCurrencyCode
      const resolved = convertAmount(item.unitCost, fromCode, orderCurrency)
      return { ...item, fromCode, resolvedUnitCost: resolved }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, catalog, branchCurrencyCode, orderCurrency, allowedCurrencies, manualRates]
  )

  const total = useMemo(
    () => resolvedItems.reduce(
      (sum, item) => sum + Number(item.qty || 0) * Number(item.resolvedUnitCost || 0),
      0
    ),
    [resolvedItems]
  )

  // Distinct currencies that have at least one item AND can't be
  // resolved right now - by definition this only happens when fromCode
  // differs from orderCurrency and no rate (branch-configured or
  // manual) exists for one or both sides. These are what block
  // submission, and what the manual-rate inputs below are for.
  const unresolvedCurrencies = useMemo(() => {
    const codes = new Set()
    resolvedItems.forEach((item) => {
      if (item.variantId && item.resolvedUnitCost == null && item.fromCode) {
        codes.add(item.fromCode)
      }
    })
    return [...codes]
  }, [resolvedItems])

  const handleSaveDraft = async () => {
    setSubmitError('')
    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }
    if (!title.trim()) {
      setSubmitError('Give this order a title before saving.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        orderNumber,
        supplierId,
        neededBy,
        notes,
        items,
        sourceRequestId: sourceRequestId || null,
        sourceRequestNumber: sourceRequestNumber || '',
        sourceRequestIds,
        sourceRequestNumbers,
        orderCurrency,
        manualRates,
        titleIsCustom,
      }

      if (draftId) {
        const { error } = await supabase
          .from('purchase_order_drafts')
          .update({
            title: title.trim(),
            payload,
            updated_by: currentUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId)
          .eq('branch', branchId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('purchase_order_drafts')
          .insert({
            company: companyId,
            branch: branchId,
            title: title.trim(),
            payload,
            created_by: currentUser.id,
            updated_by: currentUser.id,
          })
          .select('id')
          .single()

        if (error) throw error
        setDraftId(data.id)
      }

      router.push(`${base}/draft`)
    } catch (err) {
      console.error('Error saving purchase order draft:', err)
      setSubmitError(err.message || 'Something went wrong saving this draft.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!supplierId) {
      setSubmitError('A supplier is required to create a Purchase Order.')
      return
    }
    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }
    if (!title.trim()) {
      setSubmitError('Give this order a title before submitting.')
      return
    }

    const validItems = resolvedItems.filter((item) => item.variantId)
    if (validItems.length === 0) {
      setSubmitError('Add at least one product to the order.')
      return
    }

    // This is the bounce point: if any selected product's currency
    // still can't be converted into orderCurrency - no branch rate, no
    // manual rate entered - submission stops here rather than saving a
    // silently wrong number. Someone without override_currency sees
    // only the error (and who to go to); someone with it sees the
    // manual-rate inputs rendered below the line items.
    if (unresolvedCurrencies.length > 0) {
      setSubmitError(
        `Could not resolve an exchange rate for: ${unresolvedCurrencies.join(', ')}. ` +
        (canOverrideCurrency
          ? 'Enter a rate for it below before submitting.'
          : 'Ask someone with currency-override permission to enter a rate before this can be submitted.')
      )
      return
    }

    setSaving(true)

    try {
      if (sourceRequestId) {
        const { data: sourceRequest, error: sourceRequestError } = await supabase
          .from('purchase_requests')
          .select('id, status')
          .eq('id', sourceRequestId)
          .eq('branch', branchId)
          .maybeSingle()

        if (sourceRequestError) throw sourceRequestError
        if (!sourceRequest || sourceRequest.status !== 'approved') {
          throw new Error('The source request is no longer approved and cannot be converted.')
        }
      }

      if (sourceRequestIds.length > 0) {
        const { data: sourceRequests, error: sourceRequestsError } = await supabase
          .from('purchase_requests')
          .select('id, status')
          .in('id', sourceRequestIds)
          .eq('branch', branchId)

        if (sourceRequestsError) throw sourceRequestsError
        const stillApproved = (sourceRequests || []).filter((row) => row.status === 'approved')
        if (stillApproved.length !== sourceRequestIds.length) {
          throw new Error('One or more selected purchase requests are no longer approved and cannot be merged.')
        }
      }

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          branch: branchId,
          title: title.trim(),
          supplier: supplierId,
          order_number: orderNumber,
          // 'open' = this PO has been created/finalized internally.
          // It is NOT yet claiming anything was transmitted to the
          // supplier - that's a separate, later event ('sent'),
          // triggered from the order detail page's Send/Export flow,
          // not from creating the order here.
          status: 'open',
          currency: orderCurrency,
          notes: notes || null,
          expected_delivery_date: neededBy || null,
          created_by: currentUser.id,
          // Real column on purchase_orders is `purchase_request`, not
          // `source_request` - confirmed against the live schema
          // (information_schema.columns). This was the cause of the
          // PGRST204 "Could not find the 'source_request' column" error.
          purchase_request: sourceRequestId || null,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      // unit_cost_snapshot/line_total are in orderCurrency (what the
      // order is actually priced in). cost_currency/original_unit_cost
      // keep what the product's own cost was before conversion, so a
      // later audit can see what actually happened, not just the
      // converted result.
      // validItems now comes from resolvedItems directly (not a
      // separate filter over items), so each one already carries its
      // own fromCode/resolvedUnitCost - no need to re-match them up.
      const lineItems = validItems.map((item) => {
        const convertedUnitCost = item.resolvedUnitCost ?? item.unitCost
        return {
          purchase_order: order.id,
          variant: item.variantId,
          quantity_ordered: item.qty,
          unit_cost_snapshot: convertedUnitCost,
          cost_currency: item.fromCode || orderCurrency,
          original_unit_cost: item.unitCost,
          line_total: Number(item.qty || 0) * Number(convertedUnitCost || 0),
        }
      })

      const { error: lineItemsError } = await supabase
        .from('purchase_order_line_items')
        .insert(lineItems)

      if (lineItemsError) throw lineItemsError

      // Mark the source request as converted - guarded to 'approved' so
      // a stale/double submit can't flip an already-converted (or since-
      // changed) request a second time. If this update affects zero rows
      // the PO still exists (it's the source of truth now) - not treated
      // as fatal, just logged, since the convert-button guard already
      // checked this on page load.
      if (sourceRequestId) {
        const { error: requestUpdateError } = await supabase
          .from('purchase_requests')
          .update({ status: 'converted' })
          .eq('id', sourceRequestId)
          .eq('status', 'approved')

        if (requestUpdateError) {
          console.error('Order created, but failed to mark source request as converted:', requestUpdateError)
        }
      }

      // Merge path: record every merged request against this order in
      // the join table, then flip each of them to 'converted' the same
      // way the single-conversion path does above - one UPDATE covering
      // all of them, guarded to 'approved' so a stale id can't flip a
      // request that's already moved on. The per-row trigger still
      // checks purchase_orders:create on each row individually; no new
      // permission key needed for this to be safe.
      if (sourceRequestIds.length > 0) {
        const { error: sourceRequestsInsertError } = await supabase
          .from('purchase_order_source_requests')
          .insert(sourceRequestIds.map((id) => ({
            purchase_order: order.id,
            purchase_request: id,
            branch: branchId,
          })))

        if (sourceRequestsInsertError) {
          console.error('Order created, but failed to record its merged source requests:', sourceRequestsInsertError)
        }

        const { error: requestsUpdateError } = await supabase
          .from('purchase_requests')
          .update({ status: 'converted' })
          .in('id', sourceRequestIds)
          .eq('status', 'approved')

        if (requestsUpdateError) {
          console.error('Order created, but failed to mark one or more source requests as converted:', requestsUpdateError)
        }
      }

      if (draftId) {
        const { error: draftDeleteError } = await supabase
          .from('purchase_order_drafts')
          .delete()
          .eq('id', draftId)
          .eq('branch', branchId)

        if (draftDeleteError) {
          console.error('Purchase order was created, but its draft could not be deleted:', draftDeleteError)
        }
      }

      // Was `${base}/sent` - a route that doesn't exist. This should
      // land on the order's own detail page, same as every other
      // create-then-redirect flow in this module.
      router.push(`${base}/${order.id}`)
    } catch (err) {
      console.error('Error creating purchase order:', err)
      setSubmitError(err.message || 'Something went wrong saving this order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            New Purchase Order
          </h1>

          <p className="text-xs text-gray-500">
            {orderNumber}
            {sourceRequestNumber && (
              <span className="ml-2 text-gray-400">· converted from {sourceRequestNumber}</span>
            )}
            {sourceRequestNumbers.length > 0 && (
              <span className="ml-2 text-gray-400">· merged from {sourceRequestNumbers.join(', ')}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-7 text-xs"
            disabled={saving || sourceRequestLoading || draftLoading}
            onClick={handleSaveDraft}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>

          <Button
            type="submit"
            form="purchase-order-form"
            className="h-7 bg-core text-xs text-white"
            disabled={saving || sourceRequestLoading || draftLoading}
          >
            {saving ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-600">{submitError}</p>
      )}

      <form
        id="purchase-order-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 justify-between grow flex-col gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800 sm:col-span-2">
            Title <span className="text-red-500">*</span>
            <Input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setTitleIsCustom(true)
              }}
              placeholder="e.g. Lagos branch generator fuel"
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Supplier <span className="text-red-500">*</span>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue placeholder={suppliersLoading ? 'Loading suppliers...' : 'Select supplier'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="text-xs font-medium text-gray-800">
            Created by

            <p className="mt-1 h-auto w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {createdByLabel}
            </p>
          </div>

          <label className="text-xs font-medium text-gray-800">
            Needed by

            <Input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          {/* Only shown to someone with override_currency - everyone
              else is always priced in the branch's base currency, with
              no way to change that from here. */}
          {canOverrideCurrency && (
            <label className="text-xs font-medium text-gray-800">
              Order currency
              <Select value={orderCurrency} onValueChange={setOrderCurrency}>
                <SelectTrigger className="mt-1 h-auto w-full text-sm">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {allowedCurrencyCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}{code === branchCurrencyCode ? ' (branch base)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>

        <div className="flex grow flex-col overflow-hidden">
          {catalogError && (
            <p className="mb-2 text-xs text-red-600">{catalogError}</p>
          )}
          {catalogLoading || sourceRequestLoading || draftLoading ? (
            <p className="text-xs text-gray-500">
              {draftLoading
                ? 'Loading purchase order draft...'
                : sourceRequestLoading
                  ? sourceRequestIds.length > 0
                    ? 'Loading merged request items...'
                    : 'Loading request items...'
                  : 'Loading products...'}
            </p>
          ) : (
            <PurchaseOrderLineItemsTable
              items={items}
              setItems={setItems}
              catalog={catalog}
              branchCurrencyCode={branchCurrencyCode}
              branchCurrencySymbol={branchCurrencySymbol}
            />
          )}
          {unresolvedCurrencies.length > 0 && (
            <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">
                No exchange rate on file for: {unresolvedCurrencies.join(', ')} → {orderCurrency || branchCurrencyCode}.
                {!canOverrideCurrency && ' Ask someone with currency-override permission to enter a rate.'}
              </p>
              {canOverrideCurrency && (
                <div className="flex flex-wrap gap-3">
                  {unresolvedCurrencies.map((code) => (
                    <label key={code} className="text-xs font-medium text-gray-800">
                      {/* Same convention as the branch's own configured
                          rates (see allowedCurrencies above): units of
                          {branchCurrencyCode}, the branch's base
                          currency, per 1 unit of {code} - not per unit
                          of orderCurrency, even when orderCurrency is
                          something else. convertAmount() always pivots
                          through the branch base, so every rate (branch-
                          configured or manual) has to speak that same
                          language for the math to line up. */}
                      {code} rate (units of {branchCurrencyCode || 'branch base currency'} per 1 {code})
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={manualRates[code] ?? ''}
                        onChange={(event) => setManualRates((current) => ({ ...current, [code]: event.target.value }))}
                        placeholder="e.g. 1600"
                        className="mt-1 h-auto w-32 text-sm"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex-1 text-xs font-medium text-gray-700">
            Notes

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                sourceRequestNumber || sourceRequestNumbers.length > 0
                  ? "Notes for the supplier - the request's own notes are internal and are not carried over..."
                  : 'Reason, delivery details, or approval notes...'
              }
              className="mt-1 min-h-20 bg-white text-xs"
            />
          </label>

          <div className="w-full max-w-xs shrink-0 sm:ml-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                Estimated total
              </span>

              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(
                  total,
                  orderCurrency || branchCurrencyCode,
                  orderCurrency === branchCurrencyCode ? branchCurrencySymbol : undefined
                )}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}