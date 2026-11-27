'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
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
import { formatCurrency } from '@/components/modules/procurement/dummy-data'
import { usePurchaseCatalog, useSuppliers } from '@/components/modules/procurement/purchase-catalog'
import { useBranchWarehouses } from '@/components/modules/procurement/use-branch-warehouses'
import PurchaseOrderLineItemsTable from '@/components/modules/procurement/purchase-order-line-items-table'
import { callRfqRpc } from '@/components/modules/procurement/rfq-utils'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const generateOrderNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `PO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// The empty line the table always has at least one of.
// deliveryWarehouse '' = follow the order's delivery location.
const blankLine = () => ({ variantId: '', qty: 1, standardCostPrice: 0, unitCost: 0, deliveryWarehouse: '' })

// The RFQ conversion path pre-fills this form; the purchase order is still
// created here so the existing order workflow remains unchanged.
export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const initialFromRfqId = searchParams.get('fromRfq')

  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/orders`

  const [title, setTitle] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [draftId, setDraftId] = useState(draftParam || null)
  const [supplierId, setSupplierId] = useState('')
  const [creator, setCreator] = useState(null)
  const [isLoadingCreator, setIsLoadingCreator] = useState(true)
  const [creatorError, setCreatorError] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([blankLine()])
  // The order's delivery location. Every line follows it unless that line is
  // given its own. Only warehouses of this branch can be chosen; it starts as
  // the branch's default warehouse.
  const [deliveryWarehouse, setDeliveryWarehouse] = useState('')
  const [deliveryTouched, setDeliveryTouched] = useState(false)
  const { warehouses: branchWarehouses, defaultId: defaultWarehouseId } = useBranchWarehouses(branchId)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [sourceRfqId, setSourceRfqId] = useState(initialFromRfqId || '')
  const [sourceRfqLoading, setSourceRfqLoading] = useState(Boolean(initialFromRfqId || draftParam))
  const [sourceRfqNumber, setSourceRfqNumber] = useState('')
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))

  const reportOrderError = (message) => {
    setSubmitError(message)
    if (sourceRfqId) toast.error(message)
  }

  // The table always keeps one line. Whatever the table does to the list
  // (including removing the last remaining line), if the result would be
  // empty it becomes a single fresh blank line instead - so clicking the
  // red X on the last line clears and resets it rather than leaving nothing.
  const setItemsKeepingOneLine = useCallback((updater) => {
    setItems((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      return Array.isArray(next) && next.length > 0 ? next : [blankLine()]
    })
  }, [])

  const clearAllLines = () => setItems([blankLine()])
  const isAlreadyBlank = items.length === 1 && !items[0]?.variantId

  const { suppliers, loading: suppliersLoading } = useSuppliers(companyId)
  const { catalog, currencies, loading: catalogLoading, error: catalogError } =
    usePurchaseCatalog(branchId)
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

  // Every new order gets its own generated code. This is skipped when
  // loading an existing draft, whose number is already stored in its payload.
  // Traceability to an RFQ is carried by source_rfq, not by reusing its code.
  // Skipped when loading an existing draft, whose orderNumber was already generated once and
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
    // Also covers drafts saved before delivery locations existed: they come
    // back without one and get the branch default (a draft that has its own
    // marks it touched when it loads, so it is left alone).
    if (!deliveryTouched && !deliveryWarehouse && defaultWarehouseId) {
      setDeliveryWarehouse(defaultWarehouseId)
    }
  }, [defaultWarehouseId, deliveryTouched, deliveryWarehouse])

  useEffect(() => {
    let cancelled = false

    async function loadCreator() {
      setIsLoadingCreator(true)
      setCreatorError('')

      try {
        const { data, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!data?.user) throw new Error('Could not identify the signed-in user.')

        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('owner')
          .eq('id', companyId)
          .single()

        if (companyError) throw companyError

        let creatorRecord
        if (company.owner === data.user.id) {
          creatorRecord = { id: data.user.id, email: data.user.email }
        } else {
          const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, email')
            .eq('user', data.user.id)
            .eq('company', companyId)
            .maybeSingle()

          if (staffError) throw staffError
          if (!staff) throw new Error('Could not find your staff record for this company.')
          creatorRecord = staff
        }

        if (!creatorRecord.email) {
          throw new Error('Could not find an email for the creator.')
        }
        if (cancelled) return

        setCreator(creatorRecord)
      } catch (error) {
        console.error('Failed to load purchase order creator:', error)
        if (!cancelled) {
          setCreatorError(error.message || 'Could not load the purchase order creator.')
        }
      } finally {
        if (!cancelled) setIsLoadingCreator(false)
      }
    }

    loadCreator()
    return () => {
      cancelled = true
    }
  }, [companyId])

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
        setSourceRfqLoading(false)
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
        ? payload.items.map((item) => ({ deliveryWarehouse: '', ...item }))
        : [blankLine()])
      setDeliveryWarehouse(payload.deliveryWarehouse || '')
      setDeliveryTouched(Boolean(payload.deliveryWarehouse))
      setSourceRfqId(payload.sourceRfqId || '')
      setSourceRfqNumber(payload.sourceRfqNumber || '')
      setOrderCurrency(payload.orderCurrency || branchCurrencyCode)
      setManualRates(payload.manualRates && typeof payload.manualRates === 'object' ? payload.manualRates : {})
      setDraftId(data.id)
      setDraftLoading(false)
      setSourceRfqLoading(false)
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftParam, branchId])

  // Pull in the RFQ's supplier, title, currency, due date, and quoted lines.
  useEffect(() => {
    let cancelled = false

    async function loadSourceRfq() {
      if (!sourceRfqId || draftParam) return
      setSourceRfqLoading(true)

      try {
        await callRfqRpc('rfq_sweep', { p_branch: branchId })
        const { data: rfqRow, error: rfqError } = await supabase
          .from('rfqs')
          .select('id, rfq_number, name, supplier, currency, needed_by, status')
          .eq('id', sourceRfqId)
          .eq('branch', branchId)
          .maybeSingle()

        if (rfqError) throw rfqError
        if (!rfqRow) throw new Error('That RFQ could not be found.')
        if (rfqRow.status !== 'open') throw new Error('Only an Open RFQ can be converted to a purchase order.')
        if (!rfqRow.supplier) throw new Error('The RFQ has no supplier.')

        const { data: lineRows, error: lineError } = await supabase
          .from('rfq_line_items')
          .select('variant, quantity, quoted_unit_cost')
          .eq('rfq', sourceRfqId)

        if (lineError) throw lineError
        if (!lineRows?.length || lineRows.some((row) => row.quoted_unit_cost == null)) {
          throw new Error('Every RFQ line must have a quoted price before conversion.')
        }
        if (cancelled) return

        setSourceRfqNumber(rfqRow.rfq_number || '')
        setTitle(rfqRow.name || '')
        setTitleIsCustom(true)
        setSupplierId(rfqRow.supplier)
        setNeededBy(rfqRow.needed_by || '')
        setOrderCurrency(rfqRow.currency || branchCurrencyCode)
        setItems(lineRows.map((row) => ({
          variantId: row.variant,
          qty: row.quantity,
          standardCostPrice: 0,
          unitCost: Number(row.quoted_unit_cost),
          costCurrency: rfqRow.currency || branchCurrencyCode,
          deliveryWarehouse: '',
        })))
      } catch (err) {
        console.error('Failed to load source RFQ:', err)
        if (!cancelled) {
          setSubmitError(err.message || 'Could not load the source RFQ.')
          toast.error(err.message || 'Could not load the source RFQ.')
        }
      } finally {
        if (!cancelled) setSourceRfqLoading(false)
      }
    }

    loadSourceRfq()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRfqId, branchId, draftParam, branchCurrencyCode])

  const createdByLabel = creator?.email || ''

  // Each item's cost is entered in its own product's cost_currency
  // (unchanged - that input never changes), then converted into
  // orderCurrency for what actually gets totaled, displayed, and
  // eventually saved. resolved is null for an item whose currency has
  // no usable rate (branch-configured or manually entered) - those are
  // the ones that block submission below.
  const resolvedItems = useMemo(
    () => items.map((item) => {
      const variant = catalog.find((entry) => entry.id === item.variantId)
      const fromCode = item.costCurrency || variant?.cost_currency || branchCurrencyCode
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
    if (!creator?.id) {
      reportOrderError(creatorError || 'Could not identify the purchase order creator - try reloading the page.')
      return
    }
    if (!title.trim()) {
      reportOrderError('Give this order a title before saving.')
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
        sourceRfqId: sourceRfqId || null,
        sourceRfqNumber: sourceRfqNumber || '',
        orderCurrency,
        manualRates,
        titleIsCustom,
        deliveryWarehouse,
      }

      if (draftId) {
        const { error } = await supabase
          .from('purchase_order_drafts')
          .update({
            title: title.trim(),
            payload,
            updated_by: creator.id,
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
            created_by: creator.id,
            updated_by: creator.id,
          })
          .select('id')
          .single()

        if (error) throw error
        setDraftId(data.id)
      }

      if (sourceRfqId) toast.success('Purchase order draft saved')
      router.push(`${base}/draft`)
    } catch (err) {
      console.error('Error saving purchase order draft:', err)
      if (sourceRfqId) toast.error(err.message || 'Could not save this purchase order draft.')
      setSubmitError(err.message || 'Something went wrong saving this draft.')
    } finally {
      setSaving(false)
    }
  }

  // The real, final submit. After the checks below, everything that creates
  // the order happens inside ONE database function, create_purchase_order(),
  // in a single transaction: the order, its line items, linking the source
  // RFQ, and removing
  // the draft this was started from. If any part fails, nothing is saved.
  // The function also validates the source RFQ when one is supplied.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!supplierId) {
      reportOrderError('A supplier is required to create a Purchase Order.')
      return
    }
    if (!creator?.id) {
      reportOrderError(creatorError || 'Could not identify the purchase order creator - try reloading the page.')
      return
    }
    if (!title.trim()) {
      reportOrderError('Give this order a title before submitting.')
      return
    }

    const validItems = resolvedItems.filter((item) => item.variantId)
    if (validItems.length === 0) {
      reportOrderError('Add at least one product to the order.')
      return
    }
    if (!deliveryWarehouse) {
      reportOrderError('Choose where this order should be delivered.')
      return
    }

    // This is the bounce point: if any selected product's currency
    // still can't be converted into orderCurrency - no branch rate, no
    // manual rate entered - submission stops here rather than saving a
    // silently wrong number. Someone without override_currency sees
    // only the error (and who to go to); someone with it sees the
    // manual-rate inputs rendered below the line items.
    if (unresolvedCurrencies.length > 0) {
      reportOrderError(
        `Could not resolve an exchange rate for: ${unresolvedCurrencies.join(', ')}. ` +
          (canOverrideCurrency
            ? 'Enter a rate for it below before submitting.'
            : 'Ask someone with currency-override permission to enter a rate before this can be submitted.')
      )
      return
    }

    setSaving(true)

    try {
      // unit_cost_snapshot is in orderCurrency (what the order is actually
      // priced in). cost_currency / original_unit_cost keep what the
      // product's own cost was before conversion, so a later audit can see
      // what actually happened, not just the converted result. line_total
      // is worked out in the database function.
      const { data: orderId, error } = await supabase.rpc('create_purchase_order', {
        p_branch: branchId,
        p_title: title.trim(),
        p_supplier: supplierId,
        p_order_number: orderNumber,
        p_currency: orderCurrency,
        p_notes: notes || null,
        p_expected_delivery_date: neededBy || null,
        p_created_by: creator.id,
        p_line_items: validItems.map((item) => ({
          variant: item.variantId,
          quantity_ordered: item.qty,
          unit_cost_snapshot: item.resolvedUnitCost ?? item.unitCost,
          cost_currency: item.fromCode || orderCurrency,
          original_unit_cost: item.unitCost,
          // This line's own delivery location, or the order's.
          delivery_warehouse: item.deliveryWarehouse || deliveryWarehouse,
        })),
        p_source_rfq: sourceRfqId || null,
        p_draft: draftId || null,
        p_delivery_warehouse: deliveryWarehouse || null,
      })

      if (error) throw error

      if (sourceRfqId) toast.success('Purchase order created from RFQ')
      // Lands on the order's own detail page, same as every other
      // create-then-redirect flow in this module.
      router.push(`${base}/${orderId}`)
    } catch (err) {
      console.error('Error creating purchase order:', err)
      if (sourceRfqId) toast.error(err.message || 'Could not create a purchase order from this RFQ.')
      setSubmitError(err.message || 'Something went wrong saving this order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-0 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">
            New Purchase Order
          </h1>

          <p className="text-xs text-gray-500">
            {orderNumber}
            {sourceRfqNumber && (
              <span className="ml-2 text-gray-400">· From RFQ {sourceRfqNumber}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-6 text-xs"
            disabled={saving || sourceRfqLoading || draftLoading || isLoadingCreator || !creator?.id}
            onClick={handleSaveDraft}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>

          <Button
            type="submit"
            form="purchase-order-form"
            className="h-6 bg-core text-xs text-white"
            disabled={saving || sourceRfqLoading || draftLoading || isLoadingCreator || !creator?.id}
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
        className="flex min-h-0 mt-4 justify-between grow flex-col gap-1.5 overflow-hidden"
      >
        {/* Header fields: 3 columns on desktop, 2 on tablet, 1 (stacked, tighter
            spacing, smaller text) on mobile. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          <label className="text-xs font-medium text-gray-800">
            Title <span className="text-red-500">*</span>
            <Input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setTitleIsCustom(true)
              }}
              placeholder="e.g. Lagos branch generator fuel"
              className="mt-1 h-auto w-full text-xs lg:text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Supplier <span className="text-red-500">*</span>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={Boolean(sourceRfqId)}>
              <SelectTrigger className="mt-1 h-6 w-full text-xs lg:text-sm">
                <SelectValue placeholder={suppliersLoading ? 'Loading suppliers...' : 'Select supplier'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium text-gray-800">
            Created by <span className="text-red-500"></span>

            <Input
              value={isLoadingCreator ? 'Loading creator...' : createdByLabel}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q4 packaging restock"
              className="mt-1 h-auto w-full text-xs lg:text-sm"
              readOnly
            />
             {creatorError && (
              <p className="mt-1 text-xs text-red-600">{creatorError}</p>
            )}
          </label>
        
          <label className="text-xs font-medium text-gray-800">
            Needed by

            <Input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="mt-1 h-auto w-full text-xs lg:text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Delivery location <span className="text-red-500">*</span>
            <Select
              value={deliveryWarehouse}
              onValueChange={(value) => {
                setDeliveryWarehouse(value)
                setDeliveryTouched(true)
              }}
            >
              <SelectTrigger className="mt-1 h-6 w-full text-xs lg:text-sm">
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {branchWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mt-1 block text-[10px] font-normal text-gray-500">
              Every line goes here unless you choose a different warehouse on that line.
            </span>
          </label>

          {/* Only shown to someone with override_currency - everyone
              else is always priced in the branch's base currency, with
              no way to change that from here. */}
          {canOverrideCurrency && (
            <label className="text-xs font-medium text-gray-800">
              Order currency
              <Select value={orderCurrency} onValueChange={setOrderCurrency}>
                <SelectTrigger className="mt-1 h-6 w-full text-xs lg:text-sm">
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
          {catalogLoading || sourceRfqLoading || draftLoading ? (
            <p className="text-xs text-gray-500">
              {draftLoading
                ? 'Loading purchase order draft...'
                : sourceRfqLoading
                  ? 'Loading RFQ items...'
                  : 'Loading products...'}
            </p>
          ) : (
            <PurchaseOrderLineItemsTable
              items={items}
              setItems={setItemsKeepingOneLine}
              catalog={catalog}
              branchCurrencyCode={branchCurrencyCode}
              branchCurrencySymbol={branchCurrencySymbol}
              warehouses={branchWarehouses}
              orderWarehouseId={deliveryWarehouse}
              onClearAll={clearAllLines}
              clearAllDisabled={isAlreadyBlank}
            />
          )}
          {unresolvedCurrencies.length > 0 && (
            <div className="mt-1 space-y-1 rounded border border-red-200 bg-red-50 p-3">
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

        <div className="sales-document-summary flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex-1 text-xs font-medium text-gray-700">
            Notes

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                sourceRfqNumber
                  ? 'Notes for the supplier...'
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
