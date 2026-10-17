'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/modules/sales/status-badge'
import supabase from '@/config/supabaseClient'

// Per-line discrepancy badges. 'none' isn't rendered at all - only
// lines that actually have something to say about them get a badge,
// same spirit as OrderStatusBadge/StatusBadge elsewhere in this app.
const DISCREPANCY_LABELS = {
  wrong_item: 'Wrong item',
  excess: 'Excess',
}

const EXCESS_STATUS_STYLES = {
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

function ExcessStatusBadge({ status }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${EXCESS_STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

function staffName(staff) {
  if (!staff) return null
  const name = [staff.first_name, staff.last_name].filter(Boolean).join(' ')
  return name || null
}

export default function PurchaseReceiptDetailPage() {
  const { u, companyId, branchId, receiptId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`

  const [receipt, setReceipt] = useState(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [canApproveExcess, setCanApproveExcess] = useState(false)
  const [decidingLineId, setDecidingLineId] = useState('')
  const [decisionError, setDecisionError] = useState('')

  async function loadReceipt() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const { data: receiptRow, error: receiptError } = await supabase
        .from('purchase_receipts')
        .select(
          `id, receipt_number, status, notes, created_at,
           purchase_order:purchase_orders(order_number, supplier:suppliers(name))`
        )
        .eq('id', receiptId)
        .eq('branch', branchId)
        .maybeSingle()

      if (receiptError) throw receiptError
      if (!receiptRow) throw new Error('Purchase receipt not found.')

      const { data: lineRows, error: lineError } = await supabase
        .from('purchase_receipt_line_items')
        .select(
          `id, variant, purchase_order_line_item, quantity, quantity_accepted,
           excess_quantity, excess_status, discrepancy_type, excess_approved_at,
           unit_cost_snapshot, shelf,
           approver:excess_approved_by_staff(first_name, last_name)`
        )
        .eq('purchase_receipt', receiptId)

      if (lineError) throw lineError

      // Resolve variant -> product title, same pattern as the purchase
      // order detail page - showing a raw variant uuid isn't useful to
      // anyone looking at this page.
      const variantIds = [...new Set((lineRows || []).map((row) => row.variant).filter(Boolean))]
      let variantsById = new Map()
      let productsById = new Map()

      if (variantIds.length > 0) {
        const { data: variantRows, error: variantError } = await supabase
          .from('product_variants')
          .select('id, product, variant_label, sku')
          .in('id', variantIds)

        if (variantError) throw variantError
        variantsById = new Map((variantRows || []).map((v) => [v.id, v]))

        const productIds = [...new Set((variantRows || []).map((v) => v.product).filter(Boolean))]
        if (productIds.length > 0) {
          const { data: productRows, error: productError } = await supabase
            .from('products')
            .select('id, title')
            .in('id', productIds)

          if (productError) throw productError
          productsById = new Map((productRows || []).map((p) => [p.id, p]))
        }
      }

      setReceipt(receiptRow)
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
      console.error('Failed to load purchase receipt:', loadError)
      setErrorMessage(loadError.message || 'Could not load this purchase receipt.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (receiptId && branchId) loadReceipt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId, branchId])

  // Approving/rejecting excess reuses purchase_orders:edit - the same
  // authority that can amend an order in the first place. UI-level
  // check only; approve_purchase_receipt_excess() re-checks this
  // itself server-side, so a stale client check can't bypass it.
  useEffect(() => {
    let cancelled = false

    async function checkPermissions() {
      if (!branchId) return
      const { data, error } = await supabase.rpc('can_access_purchase_order_resource', {
        p_branch: branchId,
        p_verb: 'edit',
      })
      if (!cancelled) setCanApproveExcess(!error && data === true)
    }

    checkPermissions()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const handleDecision = async (lineItemId, approve) => {
    setDecisionError('')
    setDecidingLineId(lineItemId)

    try {
      const { data, error } = await supabase.rpc('approve_purchase_receipt_excess', {
        p_line_item: lineItemId,
        p_approve: approve,
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Could not record that decision.')

      await loadReceipt()
    } catch (err) {
      console.error('Failed to decide on excess:', err)
      setDecisionError(err.message || 'Could not record that decision.')
    } finally {
      setDecidingLineId('')
    }
  }

  if (isLoading) {
    return <p className=" text-xs text-muted-foreground">Loading receipt...</p>
  }

  if (errorMessage) {
    return (
      <div className="space-y-3 text-xs">
        <Link href={base}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to receipts
          </Button>
        </Link>
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      </div>
    )
  }

  const adjustmentLines = items.filter((item) => item.discrepancy_type !== 'none')

  return (
    <div className="space-y-3  text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={base}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to receipts
          </Button>
        </Link>
        {receipt.status === 'draft' && (
          <Link href={`${base}/${receiptId}/edit`}>
            <Button type="button" size="sm" className="h-7 rounded-sm bg-core text-xs text-white">
              <Pencil className="mr-1.5 size-3" /> Edit
            </Button>
          </Link>
        )}
      </div>

      <section className="space-y-3 rounded-sm border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              Receipt {receipt.receipt_number}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Purchase order: {receipt.purchase_order?.order_number || '—'}
            </p>
            <p className="text-muted-foreground">
              Supplier: {receipt.purchase_order?.supplier?.name || '—'}
            </p>
          </div>
          <StatusBadge status={receipt.status} />
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-foreground">Received items</h2>
          {items.length === 0 ? (
            <p className="text-muted-foreground">No items on this receipt.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                    <th className="px-3 py-2 text-left">Shelf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-700">
                        <span className="font-medium text-foreground">{item.productTitle}</span>
                        {item.variantLabel !== 'Default variant' && (
                          <span className="ml-1 text-muted-foreground">· {item.variantLabel}</span>
                        )}
                        {item.sku && <span className="ml-1 text-muted-foreground">({item.sku})</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.quantity}
                        {item.discrepancy_type !== 'none' && (
                          <span className="ml-1 text-muted-foreground">
                            ({item.quantity_accepted} accepted{Number(item.excess_quantity) > 0 ? `, ${item.excess_quantity} held` : ''})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{item.unit_cost_snapshot}</td>
                      <td className="px-3 py-2 text-gray-700">{item.shelf || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-foreground">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {receipt.notes || '—'}
          </p>
        </div>
      </section>

      {adjustmentLines.length > 0 && (
        <section className="space-y-3 rounded-sm border border-amber-200 bg-amber-50/40 p-4">
          <h2 className="font-semibold text-foreground">Adjustments</h2>
          <p className="text-muted-foreground">
            Something on this receipt didn't match the order exactly. The accepted portion of each
            line already posted; what's held below is still physically on hand, just not counted as
            sellable stock until it's decided on.
          </p>

          {decisionError && (
            <p role="alert" className="text-red-600">{decisionError}</p>
          )}

          <div className="space-y-2">
            {adjustmentLines.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-200 bg-white p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.productTitle}</span>
                    {item.variantLabel !== 'Default variant' && (
                      <span className="text-muted-foreground">· {item.variantLabel}</span>
                    )}
                    <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                      {DISCREPANCY_LABELS[item.discrepancy_type] || item.discrepancy_type}
                    </span>
                    <ExcessStatusBadge status={item.excess_status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {item.excess_quantity} unit{Number(item.excess_quantity) === 1 ? '' : 's'} held
                    {item.excess_status !== 'pending_approval' && (
                      <>
                        {' '}· {staffName(item.approver) ? `by ${staffName(item.approver)}` : 'by the company owner'}
                        {item.excess_approved_at && ` on ${new Date(item.excess_approved_at).toLocaleDateString()}`}
                      </>
                    )}
                  </p>
                </div>

                {canApproveExcess && item.excess_status === 'pending_approval' && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 rounded-sm bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      disabled={decidingLineId === item.id}
                      onClick={() => handleDecision(item.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-sm border-red-200 text-xs text-red-700 hover:bg-red-50"
                      disabled={decidingLineId === item.id}
                      onClick={() => handleDecision(item.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}