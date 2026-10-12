'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import PurchaseRequestLineItemsTable from '@/components/modules/purchases/purchase-request-line-items-table'
import { RequestStatusBadge } from '@/components/modules/purchases/purchase-requests-list-page'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

// A real purchase_requests row is never 'draft' - that state now lives
// only in purchase_request_drafts (a separate JSONB table). A real row
// starts at 'pending_approval' and can be edited in two cases:
//  - 'pending_approval': nothing has acted on it yet, so the requester
//    can still correct it. Saving leaves it at 'pending_approval'.
//  - 'rejected': editing it is treated as a resubmission - saving moves
//    it back to 'pending_approval' so it re-enters the queue, rather
//    than sitting labeled "Rejected" after being fixed.
// 'approved' and 'converted' are deliberately NOT editable here:
//  - 'approved' means someone signed off on this exact content; letting
//    it be silently edited afterward would approve content nobody
//    actually saw. (Revisit once a real approve/reject action exists -
//    for now the only way to change an approved request is to not have
//    approved it yet.)
//  - 'converted' means a purchase order already exists from this
//    request - it's a historical record at that point, not an editable
//    draft of one.
const EDITABLE_STATUSES = ['pending_approval', 'rejected']

export default function EditPurchaseRequestPage() {
  const router = useRouter()
  const { u, companyId, branchId, requestId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`

  const [request, setRequest] = useState(null)
  const [title, setTitle] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ variantId: '', qty: 1, estimatedCostPrice: 0 }])
  const [originalLineIds, setOriginalLineIds] = useState([])
  const [isLoadingRequest, setIsLoadingRequest] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const {
    catalog,
    currencies,
    loading: catalogLoading,
    error: catalogError,
  } = useRequestCatalog(branchId)

  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  const total = useMemo(
    () => items.reduce(
      (sum, item) => sum + Number(item.qty || 0) * Number(item.estimatedCostPrice || 0),
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

  useEffect(() => {
    let cancelled = false

    async function loadRequest() {
      setIsLoadingRequest(true)
      setErrorMessage('')

      try {
        const { data: requestRow, error: requestError } = await supabase
          .from('purchase_requests')
          .select('id, title, request_number, requested_by, needed_by, notes, status, created_at, branch')
          .eq('id', requestId)
          .eq('branch', branchId)
          .maybeSingle()

        if (requestError) throw requestError
        if (!requestRow) throw new Error('Purchase request not found.')
        if (!EDITABLE_STATUSES.includes(requestRow.status)) {
          throw new Error('Only pending or rejected purchase requests can be edited.')
        }

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_request_line_items')
          .select('id, variant, quantity_requested, estimated_unit_cost')
          .eq('purchase_request', requestId)

        if (lineError) throw lineError
        if (cancelled) return

        setRequest(requestRow)
        setTitle(requestRow.title || '')
        setNeededBy(requestRow.needed_by || '')
        setNotes(requestRow.notes || '')
        setOriginalLineIds((lineRows || []).map((row) => row.id))
        setItems(
          (lineRows || []).length > 0
            ? lineRows.map((row) => ({
                id: row.id,
                variantId: row.variant,
                qty: row.quantity_requested,
                estimatedCostPrice: row.estimated_unit_cost,
              }))
            : [{ variantId: '', qty: 1, estimatedCostPrice: 0 }]
        )
      } catch (error) {
        console.error('Failed to load purchase request for editing:', error)
        if (!cancelled) setErrorMessage(error.message || 'Could not load this purchase request.')
      } finally {
        if (!cancelled) setIsLoadingRequest(false)
      }
    }

    if (requestId && branchId) loadRequest()
    return () => {
      cancelled = true
    }
  }, [requestId, branchId])

  const handleSave = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!request) return

    const validItems = items.filter((item) => item.variantId)
    if (validItems.length === 0) {
      setErrorMessage('Add at least one product to the request.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Give this request a title before saving.')
      return
    }

    setIsSaving(true)

    try {
      // Saving always lands on 'pending_approval', whether it started
      // there (no-op) or started 'rejected' (resubmission) - see
      // EDITABLE_STATUSES comment above. The .in(...) guard still
      // protects against a race where the status changed server-side
      // between load and save (e.g. someone else approved/rejected it
      // in the meantime).
      const { data: updatedRequest, error: requestUpdateError } = await supabase
        .from('purchase_requests')
        .update({
          title: title.trim(),
          needed_by: neededBy || null,
          notes: notes || null,
          status: 'pending_approval',
        })
        .eq('id', requestId)
        .eq('branch', branchId)
        .in('status', EDITABLE_STATUSES)
        .select('id')
        .maybeSingle()

      if (requestUpdateError) throw requestUpdateError
      if (!updatedRequest) {
        throw new Error('This request is no longer editable. Refresh the page and try again.')
      }

      const retainedLineIds = validItems.filter((item) => item.id).map((item) => item.id)
      const removedLineIds = originalLineIds.filter((lineId) => !retainedLineIds.includes(lineId))

      const lineUpdates = validItems
        .filter((item) => item.id)
        .map((item) => supabase
          .from('purchase_request_line_items')
          .update({
            variant: item.variantId,
            quantity_requested: item.qty,
            estimated_unit_cost: item.estimatedCostPrice,
          })
          .eq('id', item.id)
          .eq('purchase_request', requestId))

      const newLineItems = validItems
        .filter((item) => !item.id)
        .map((item) => ({
          purchase_request: requestId,
          variant: item.variantId,
          quantity_requested: item.qty,
          estimated_unit_cost: item.estimatedCostPrice,
        }))

      const mutations = await Promise.all([
        ...lineUpdates,
        ...(newLineItems.length > 0
          ? [supabase.from('purchase_request_line_items').insert(newLineItems)]
          : []),
        ...(removedLineIds.length > 0
          ? [supabase
              .from('purchase_request_line_items')
              .delete()
              .eq('purchase_request', requestId)
              .in('id', removedLineIds)]
          : []),
      ])

      const lineError = mutations.find((result) => result.error)?.error
      if (lineError) throw lineError

      router.push(`${base}/${requestId}`)
    } catch (error) {
      console.error('Failed to update purchase request:', error)
      setErrorMessage(error.message || 'Could not update this purchase request.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingRequest) {
    return <p className="p-4 text-xs text-muted-foreground">Loading purchase request...</p>
  }

  if (errorMessage && !request) {
    return (
      <div className="space-y-3 p-4">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.back()}>
          Cancel
        </Button>
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            {request.title || 'Edit Purchase Request'}
          </h1>
          <p className="text-xs text-gray-500">{request.request_number || request.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" form="edit-purchase-request-form" className="h-7 bg-core text-xs text-white" disabled={isSaving || catalogLoading}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {request.status && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Current status: <RequestStatusBadge status={request.status} />
          {request.status === 'rejected' && (
            <span className="text-amber-600">— saving will resubmit this for approval</span>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">{errorMessage}</p>
      )}
      {catalogError && (
        <p className="text-xs text-red-600">{catalogError}</p>
      )}

      <form
        id="edit-purchase-request-form"
        onSubmit={handleSave}
        className="flex min-h-0 grow flex-col justify-between gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800 sm:col-span-2">
            Title <span className="text-red-500">*</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q4 packaging restock"
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <div className="text-xs font-medium text-gray-800">
            Requested by
            <p className="mt-1 h-auto w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {request.requested_by || '—'}
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

        <div className="flex min-h-0 grow flex-col overflow-hidden">
          {catalogLoading ? (
            <p className="text-xs text-gray-500">Loading products...</p>
          ) : (
            <PurchaseRequestLineItemsTable
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
              placeholder="Reason, delivery details, or approval notes..."
              className="mt-1 min-h-20 bg-white text-xs"
            />
          </label>
          <div className="w-full max-w-xs shrink-0 sm:ml-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Estimated total</span>
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