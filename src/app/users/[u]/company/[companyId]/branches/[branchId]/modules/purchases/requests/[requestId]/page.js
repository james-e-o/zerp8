'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { RequestStatusBadge } from '@/components/modules/purchases/purchase-requests-list-page'

// A real purchase_requests row is never 'draft' - that state lives in
// purchase_request_drafts instead, so it's dropped from both this map
// and the edit-button condition below. Edit is allowed only for
// 'pending_approval' (nothing has acted on it yet) and 'rejected'
// (editing = resubmission) - see edit-purchase-request-page.jsx for the
// full reasoning. 'approved' and 'converted' are locked.
const STATUS_ROUTE = {
  pending_approval: 'pending-approval',
}
const EDITABLE_STATUSES = ['pending_approval', 'rejected']

// Cancelling replaces deleting for real rows - a cancelled request is
// never removed outright, it's moved whole (row + line items, folded
// into one JSONB snapshot) into cancelled_purchase_requests by the
// cancel_purchase_request() database function. Eligible only from
// 'pending_approval' and 'approved' - 'rejected' and 'converted' are
// already closed-out states with nothing left to cancel. Gated on the
// same 'approve' permission as Approve/Reject (no separate 'cancel'
// permission key was introduced - reusing approve was the explicit
// decision here).
const CANCEL_ELIGIBLE_STATUSES = ['pending_approval', 'approved']

export default function PurchaseRequestDetailPage() {
  const { u, companyId, branchId, requestId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext) || {}
  const [request, setRequest] = useState(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [canApprove, setCanApprove] = useState(false)
  const [canCreateOrder, setCanCreateOrder] = useState(false)
  const [isDeciding, setIsDeciding] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [isConverting, setIsConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`

  useEffect(() => {
    let cancelled = false

    async function loadRequest() {
      setIsLoading(true)
      setError('')

      try {
        const { data: requestRow, error: requestError } = await supabase
          .from('purchase_requests')
          .select(
            'id, title, request_number, requested_by, needed_by, notes, status, created_at, branch, approved_by, approved_at, rejected_by, rejected_at, rejection_reason'
          )
          .eq('id', requestId)
          .eq('branch', branchId)
          .maybeSingle()

        if (requestError) throw requestError
        if (!requestRow) throw new Error('Purchase request not found.')

        const { data: lineRows, error: lineError } = await supabase
          .from('purchase_request_line_items')
          .select('id, variant, quantity_requested, estimated_unit_cost')
          .eq('purchase_request', requestId)

        if (lineError) throw lineError

        const variantIds = [...new Set((lineRows || []).map((row) => row.variant).filter(Boolean))]
        let variants = []
        let products = []

        if (variantIds.length > 0) {
          const { data: variantRows, error: variantError } = await supabase
            .from('product_variants')
            .select('id, product, variant_label, sku')
            .in('id', variantIds)

          if (variantError) throw variantError
          variants = variantRows || []

          const productIds = [...new Set(variants.map((variant) => variant.product).filter(Boolean))]
          if (productIds.length > 0) {
            const { data: productRows, error: productError } = await supabase
              .from('products')
              .select('id, title')
              .in('id', productIds)

            if (productError) throw productError
            products = productRows || []
          }
        }

        if (cancelled) return

        const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
        const productsById = new Map(products.map((product) => [product.id, product]))

        setRequest(requestRow)
        setItems((lineRows || []).map((row) => {
          const variant = variantsById.get(row.variant)
          const product = variant ? productsById.get(variant.product) : null
          return {
            ...row,
            productTitle: product?.title || 'Product unavailable',
            variantLabel: variant?.variant_label || 'Default variant',
            sku: variant?.sku || '',
          }
        }))
      } catch (loadError) {
        console.error('Failed to load purchase request:', loadError)
        if (!cancelled) setError(loadError.message || 'Failed to load purchase request.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (requestId && branchId) loadRequest()
    return () => {
      cancelled = true
    }
  }, [requestId, branchId])

  // Approve/Reject are only ever offered to staff with the dedicated
  // 'approve' permission - distinct from the create/edit permission a
  // requester has on their own request. This is a UI-level check only;
  // the actual enforcement lives server-side in the
  // purchase_requests_enforce_approval trigger, so a stale/bypassed
  // client check can't let an unauthorized update through.
  //
  // Separately: "Convert to Purchase Order" needs purchase_orders:create,
  // NOT purchase_requests:approve - they're two different resources
  // after the permission split (can_access_purchase_order_resource vs
  // can_access_purchase_resource), on purpose. Someone can approve a
  // request without being allowed to actually raise the order it turns
  // into. Without this check the button would still be safe (the New
  // Purchase Order page's insert is blocked server-side by RLS either
  // way) but it'd be a dead end - approved, then click through, fill out
  // a whole order, and only then get rejected. This hides it up front
  // for anyone who can't actually complete the conversion.
  useEffect(() => {
    let cancelled = false

    async function checkPermissions() {
      if (!branchId) return

      const [approveResult, createOrderResult] = await Promise.all([
        supabase.rpc('can_access_purchase_resource', { p_branch: branchId, p_verb: 'approve' }),
        supabase.rpc('can_access_purchase_order_resource', { p_branch: branchId, p_verb: 'create' }),
      ])

      if (cancelled) return
      setCanApprove(!approveResult.error && approveResult.data === true)
      setCanCreateOrder(!createOrderResult.error && createOrderResult.data === true)
    }

    checkPermissions()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const handleApprove = async () => {
    if (!request) return
    setDecisionError('')
    setIsDeciding(true)

    try {
      const { data: updatedRequest, error: updateError } = await supabase
        .from('purchase_requests')
        .update({ status: 'approved' })
        .eq('id', request.id)
        .eq('branch', branchId)
        .eq('status', 'pending_approval')
        .select(
          'id, title, request_number, requested_by, needed_by, notes, status, created_at, branch, approved_by, approved_at, rejected_by, rejected_at, rejection_reason'
        )
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedRequest) {
        throw new Error('This request is no longer pending approval. Refresh the page and try again.')
      }

      setRequest(updatedRequest)
    } catch (approveError) {
      console.error('Failed to approve purchase request:', approveError)
      setDecisionError(approveError.message || 'Could not approve this request.')
    } finally {
      setIsDeciding(false)
    }
  }

  const handleReject = async () => {
    if (!request) return
    setDecisionError('')
    setIsDeciding(true)

    try {
      const { data: updatedRequest, error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim() || null,
        })
        .eq('id', request.id)
        .eq('branch', branchId)
        .eq('status', 'pending_approval')
        .select(
          'id, title, request_number, requested_by, needed_by, notes, status, created_at, branch, approved_by, approved_at, rejected_by, rejected_at, rejection_reason'
        )
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedRequest) {
        throw new Error('This request is no longer pending approval. Refresh the page and try again.')
      }

      setRequest(updatedRequest)
      setShowRejectForm(false)
      setRejectReason('')
    } catch (rejectError) {
      console.error('Failed to reject purchase request:', rejectError)
      setDecisionError(rejectError.message || 'Could not reject this request.')
    } finally {
      setIsDeciding(false)
    }
  }

  // "Convert to Purchase Order" used to be a plain navigate+prefill link
  // (?fromRequest=<id>), which meant any progress filling out the New PO
  // form was lost if the person navigated away before submitting. This
  // now creates a real, persisted purchase_order_drafts row up front -
  // same draft table the New PO page already saves to - and sends the
  // person straight into it via ?draft=<id>, so nothing is lost.
  //
  // Importantly, this does NOT flip the request's status to 'converted'.
  // A draft isn't a real commitment - abandoning it would permanently
  // strand this request at 'converted' with no purchase order ever
  // created, and there's no "unconvert" path. The request stays
  // 'approved' until a real order is actually sent (unchanged - that
  // still happens on the New PO form's "Mark as Sent" submit).
  const handleConvertToOrder = async () => {
    if (!request) return
    setConvertError('')
    setIsConverting(true)

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const currentUserId = userData?.user?.id
      if (!currentUserId) throw new Error('Could not determine the current user.')

      const payload = {
        // The order carries the SAME reference code as the request it
        // was converted from - it is not given its own independently
        // generated number. A brand-new order with no source request
        // still gets a fresh generated code (see generateOrderNumber()
        // on the New Purchase Order page); this one is a straight
        // carry-over so the two documents stay traceable as one thread.
        orderNumber: request.request_number,
        supplierId: '',
        neededBy: request.needed_by || '',
        notes: '',
        items: items.map((item) => ({
          variantId: item.variant,
          quantity: Number(item.quantity_requested || 0),
          unitCost: Number(item.estimated_unit_cost || 0),
        })),
        sourceRequestId: request.id,
        sourceRequestNumber: request.request_number,
      }

      const { data: draft, error: draftError } = await supabase
        .from('purchase_order_drafts')
        .insert({
          company: companyId,
          branch: branchId,
          title: request.title ? request.title : null,
          payload,
          created_by: currentUserId,
          updated_by: currentUserId,
        })
        .select('id')
        .single()

      if (draftError) throw draftError

      router.push(`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders/new?draft=${draft.id}`)
    } catch (err) {
      console.error('Failed to start purchase order from request:', err)
      setConvertError(err.message || 'Could not start a purchase order from this request.')
      setIsConverting(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!request) return
    setCancelError('')
    setIsCancelling(true)

    try {
      const { error: cancelRpcError } = await supabase.rpc('cancel_purchase_request', {
        p_request_id: request.id,
        p_reason: cancelReason.trim() || null,
      })

      if (cancelRpcError) throw cancelRpcError

      router.push(basePath)
    } catch (err) {
      console.error('Failed to cancel purchase request:', err)
      setCancelError(err.message || 'Could not cancel this request.')
      setIsCancelling(false)
    }
  }

  const statusRoute = request ? STATUS_ROUTE[request.status] || request.status : ''
  const backHref = statusRoute ? `${basePath}/${statusRoute}` : basePath
  const total = items.reduce(
    (sum, item) => sum + Number(item.quantity_requested || 0) * Number(item.estimated_unit_cost || 0),
    0
  )

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading purchase request...</p>
  }

  if (error || !request) {
    return (
      <div className="space-y-4 p-4">
        <Link href={basePath}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to requests
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error || 'Purchase request not found.'}
        </div>
      </div>
    )
  }

  const showApprovalActions = canApprove && request.status === 'pending_approval'

  return (
    <div className="space-y-4 text-xs ">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {request.title || request.request_number || `Request ${request.id}`}
            </h1>
            {request.title && (
              <p className="text-[10px] text-muted-foreground">{request.request_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RequestStatusBadge status={request.status} />
          {EDITABLE_STATUSES.includes(request.status) && (
            <Link href={`${basePath}/${request.id}/edit`}>
              <Button type="button" variant="outline" size="sm" className="h-7 bg-core_light rounded-sm text-xs">
                <Pencil className="mr-1.5 size-3" /> Edit
              </Button>
            </Link>
          )}
          {showApprovalActions && (
            <>
              <Button
                type="button"
                size="sm"
                className="h-7 bg-emerald-600 rounded-sm text-xs text-white hover:bg-emerald-700"
                disabled={isDeciding}
                onClick={handleApprove}
              >
                {isDeciding ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-sm text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={isDeciding}
                onClick={() => setShowRejectForm((shown) => !shown)}
              >
                Reject
              </Button>
            </>
          )}
          {request.status === 'approved' && canCreateOrder && (
            <Button
              type="button"
              size="sm"
              className="h-7 bg-core rounded-sm text-xs text-white"
              disabled={isConverting}
              onClick={handleConvertToOrder}
            >
              {isConverting ? 'Starting order...' : 'Convert to Purchase Order'}
            </Button>
          )}
          {canApprove && CANCEL_ELIGIBLE_STATUSES.includes(request.status) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs border-red-200 text-red-700 hover:bg-red-50"
              disabled={isCancelling}
              onClick={() => setShowCancelConfirm((shown) => !shown)}
            >
              Cancel request
            </Button>
          )}
        </div>
      </div>

      {decisionError && (
        <p role="alert" className="text-xs text-red-600">{decisionError}</p>
      )}

      {convertError && (
        <p role="alert" className="text-xs text-red-600">{convertError}</p>
      )}

      {showCancelConfirm && (
        <div className="border border-red-200 bg-red-50/60 rounded-sm p-3 space-y-2">
          <p className="text-[10px] font-medium text-red-800">
            Cancel this purchase request? It will be removed from the active list and archived - this can't be undone from here.
          </p>
          <label className="block text-[10px] font-medium text-red-800">
            Reason (optional)
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="e.g. No longer needed, duplicate request, budget pulled..."
              className="mt-1 min-h-16 bg-white text-xs"
            />
          </label>
          {cancelError && (
            <p role="alert" className="text-xs text-red-600">{cancelError}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 bg-red-600 rounded-sm text-xs text-white hover:bg-red-700"
              disabled={isCancelling}
              onClick={handleCancelRequest}
            >
              {isCancelling ? 'Cancelling...' : 'Confirm cancellation'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              disabled={isCancelling}
              onClick={() => {
                setShowCancelConfirm(false)
                setCancelError('')
                setCancelReason('')
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {showApprovalActions && showRejectForm && (
        <div className="border border-red-200 bg-red-50/60 rounded-sm p-3 space-y-2">
          <label className="block text-[10px] font-medium text-red-800">
            Reason for rejection (optional - shown to the requester)
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Budget not available this period, wrong supplier category, duplicate request..."
              className="mt-1 min-h-16 bg-white text-xs"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 bg-red-600 rounded-sm text-xs text-white hover:bg-red-700"
              disabled={isDeciding}
              onClick={handleReject}
            >
              {isDeciding ? 'Rejecting...' : 'Confirm rejection'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              disabled={isDeciding}
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <section className="border border-border rounded-sm bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Request details
        </h2>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">Requested by</dt>
            <dd className="mt-1 break-all font-medium text-foreground">{request.requested_by || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Needed by</dt>
            <dd className="mt-1 font-medium text-foreground">
              {request.needed_by ? new Date(`${request.needed_by}T00:00:00`).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Created</dt>
            <dd className="mt-1 font-medium text-foreground">
              {request.created_at ? new Date(request.created_at).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Branch currency</dt>
            <dd className="mt-1 font-medium text-foreground">{currentBranch?.base_currency || '—'}</dd>
          </div>
          {request.status === 'approved' && request.approved_at && (
            <div>
              <dt className="text-[10px] text-muted-foreground">Approved</dt>
              <dd className="mt-1 font-medium text-foreground">
                {new Date(request.approved_at).toLocaleString()}
              </dd>
            </div>
          )}
          {request.status === 'rejected' && request.rejected_at && (
            <div>
              <dt className="text-[10px] text-muted-foreground">Rejected</dt>
              <dd className="mt-1 font-medium text-foreground">
                {new Date(request.rejected_at).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
        {request.notes && (
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{request.notes}</p>
          </div>
        )}
        {request.status === 'rejected' && request.rejection_reason && (
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] text-muted-foreground">Rejection reason</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-red-700">{request.rejection_reason}</p>
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-border rounded-sm bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Requested items
        </h2>
        {items.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">This request has no line items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Product</th>
                  <th className="px-4 py-2 text-left font-medium">SKU</th>
                  <th className="px-4 py-2 text-right font-medium">Quantity</th>
                  <th className="px-4 py-2 text-right font-medium">Estimated unit cost</th>
                  <th className="px-4 py-2 text-right font-medium">Estimated amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-foreground">
                      {item.productTitle}
                      {item.variantLabel !== 'Default variant' && (
                        <span className="ml-1 text-muted-foreground">· {item.variantLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{item.sku || '—'}</td>
                    <td className="px-4 py-2 text-right text-foreground">{Number(item.quantity_requested || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(item.estimated_unit_cost, currentBranch?.base_currency || '')}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">
                      {formatCurrency(Number(item.quantity_requested || 0) * Number(item.estimated_unit_cost || 0), currentBranch?.base_currency || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30">
                <tr>
                  <th colSpan={4} className="px-4 py-3 text-right text-xs font-semibold text-foreground">Estimated total</th>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                    {formatCurrency(total, currentBranch?.base_currency || '')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}