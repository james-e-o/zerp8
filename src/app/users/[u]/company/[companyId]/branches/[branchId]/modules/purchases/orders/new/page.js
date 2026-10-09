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
export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const initialFromRequestId = searchParams.get('fromRequest')

  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

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
  const [sourceRequestLoading, setSourceRequestLoading] = useState(Boolean(initialFromRequestId || draftParam))
  const [sourceRequestNumber, setSourceRequestNumber] = useState('')
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))

  const { suppliers, loading: suppliersLoading } = useSuppliers(companyId)
  const { catalog, currencies, loading: catalogLoading, error: catalogError } =
    useRequestCatalog(branchId)
  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  useEffect(() => {
    if (!draftParam) setOrderNumber(generateOrderNumber())
  }, [draftParam])

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
      setOrderNumber(data.title || generateOrderNumber())
      setSupplierId(payload.supplierId || '')
      setNeededBy(payload.neededBy || '')
      setNotes(payload.notes || '')
      setItems(Array.isArray(payload.items) && payload.items.length > 0
        ? payload.items
        : [{ variantId: '', qty: 1, standardCostPrice: 0, unitCost: 0 }])
      setSourceRequestId(payload.sourceRequestId || '')
      setSourceRequestNumber(payload.sourceRequestNumber || '')
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
  }, [sourceRequestId, branchId, draftParam])

  const createdByLabel =
    currentUser?.user_metadata?.full_name || currentUser?.email || 'You'

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  )

  const currencyMismatches = useMemo(
    () => items
      .map((item) => catalog.find((entry) => entry.id === item.variantId))
      .filter((variant) => variant?.cost_currency && variant.cost_currency !== branchCurrencyCode),
    [catalog, items, branchCurrencyCode]
  )

  const handleSaveDraft = async () => {
    setSubmitError('')
    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        supplierId,
        neededBy,
        notes,
        items,
        sourceRequestId: sourceRequestId || null,
        sourceRequestNumber: sourceRequestNumber || '',
      }

      if (draftId) {
        const { error } = await supabase
          .from('purchase_order_drafts')
          .update({
            title: orderNumber,
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
            title: orderNumber,
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

    const validItems = items.filter((item) => item.variantId)
    if (validItems.length === 0) {
      setSubmitError('Add at least one product to the order.')
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

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          branch: branchId,
          supplier: supplierId,
          order_number: orderNumber,
          status: 'sent',
          notes: notes || null,
          expected_delivery_date: neededBy || null,
          created_by: currentUser.id,
          source_request: sourceRequestId || null,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const lineItems = validItems.map((item) => ({
        purchase_order: order.id,
        variant: item.variantId,
        quantity_ordered: item.qty,
        unit_cost_snapshot: item.unitCost,
        line_total: Number(item.qty || 0) * Number(item.unitCost || 0),
      }))

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

      if (draftId) {
        const { error: draftDeleteError } = await supabase
          .from('purchase_order_drafts')
          .delete()
          .eq('id', draftId)
          .eq('branch', branchId)

        if (draftDeleteError) {
          console.error('Purchase order was sent, but its draft could not be deleted:', draftDeleteError)
        }
      }

      router.push(`${base}/sent`)
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
            {saving ? 'Saving...' : 'Mark as Sent'}
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
                  ? 'Loading request items...'
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
          {currencyMismatches.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Some selected products use a different cost currency than this branch ({branchCurrencyCode || 'base currency'}).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex-1 text-xs font-medium text-gray-700">
            Notes

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                sourceRequestNumber
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
                {formatCurrency(total, branchCurrencyCode, branchCurrencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}