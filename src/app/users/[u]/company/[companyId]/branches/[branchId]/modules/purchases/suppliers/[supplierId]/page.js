'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { OrderStatusBadge } from '@/components/modules/purchases/purchase-orders-list-page'
import { SupplierStatusBadge } from '@/components/modules/purchases/suppliers-list'
import { RESOLUTION_LABELS, Stat } from '@/components/modules/purchases/supplier-credit-shared'

export default function SupplierDetailPage() {
  const { u, companyId, branchId, supplierId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`
  const money = (amount) => formatCurrency(Number(amount || 0), currentBranch?.base_currency || '')

  const [supplier, setSupplier] = useState(null)
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState(null)
  const [awaiting, setAwaiting] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        // Suppliers are branch-owned - a supplier only exists within
        // the branch it was created in, so both company and branch
        // are part of the lookup, same as every other resource in
        // this module.
        const { data: supplierRow, error: supplierError } = await supabase
          .from('suppliers')
          .select('id, name, email, phone, address, payment_terms, status')
          .eq('id', supplierId)
          .eq('company', companyId)
          .eq('branch', branchId)
          .maybeSingle()

        if (supplierError) throw supplierError
        if (!supplierRow) throw new Error('Supplier not found.')

        const { data: orderRows, error: orderError } = await supabase
          .from('purchase_orders')
          .select('id, title, order_number, status, created_at, purchase_order_line_items(line_total)')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .order('created_at', { ascending: false })

        if (orderError) throw orderError

        // Money position and the returns still waiting for an outcome. These
        // come from views added with the supplier credits migration; if that
        // migration has not been run yet the section simply stays hidden.
        const { data: summaryRow } = await supabase
          .from('supplier_account_summary')
          .select('*')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .maybeSingle()

        let awaitingRows = []
        const { data: recoveryRows } = await supabase
          .from('purchase_return_recovery')
          .select('purchase_return, value, recovered, outstanding, resolution')
          .eq('supplier', supplierId)
          .eq('branch', branchId)
          .eq('is_awaiting', true)
        if ((recoveryRows || []).length > 0) {
          const { data: returnRows } = await supabase
            .from('purchase_returns')
            .select('id, return_number, dispatched_at')
            .in('id', recoveryRows.map((row) => row.purchase_return))
          const byId = Object.fromEntries((returnRows || []).map((row) => [row.id, row]))
          awaitingRows = recoveryRows.map((row) => ({ ...row, ...(byId[row.purchase_return] || {}) }))
        }

        if (!cancelled) {
          setSupplier(supplierRow)
          setSummary(summaryRow || null)
          setAwaiting(awaitingRows)
          setOrders((orderRows || []).map((order) => ({
            ...order,
            total: (order.purchase_order_line_items || []).reduce(
              (sum, line) => sum + Number(line.line_total || 0),
              0
            ),
          })))
        }
      } catch (err) {
        console.error('Failed to load supplier:', err)
        if (!cancelled) setErrorMessage(err.message || 'Could not load this supplier.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (supplierId && companyId && branchId) load()
    return () => {
      cancelled = true
    }
  }, [supplierId, companyId, branchId])

  const toggleStatus = async () => {
    if (!supplier) return
    const nextStatus = supplier.status === 'inactive' ? 'active' : 'inactive'
    setStatusSaving(true)
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ status: nextStatus })
        .eq('id', supplierId)
        .eq('company', companyId)
        .eq('branch', branchId)

      if (error) throw error
      setSupplier((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    } catch (err) {
      console.error('Failed to update supplier status:', err)
      setErrorMessage(err.message || 'Could not update supplier status.')
    } finally {
      setStatusSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading supplier...</p>
  }

  if (errorMessage || !supplier) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/suppliers`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to suppliers
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage || 'Supplier not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`${base}/suppliers`}>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">{supplier.name}</h1>
          <SupplierStatusBadge status={supplier.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-sm text-xs"
            onClick={toggleStatus}
            disabled={statusSaving}
          >
            {statusSaving
              ? 'Saving...'
              : supplier.status === 'inactive'
                ? 'Mark active'
                : 'Mark inactive'}
          </Button>
          <Link href={`${base}/suppliers/${supplier.id}/edit`}>
            <Button type="button" variant="outline" size="sm" className="h-7 bg-core_light rounded-sm text-xs">
              <Pencil className="mr-1.5 size-3" /> Edit
            </Button>
          </Link>
        </div>
      </div>

      <section className="border border-border rounded-sm bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Supplier details
        </h2>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">Email</dt>
            <dd className="mt-1 break-all font-medium text-foreground">{supplier.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Phone</dt>
            <dd className="mt-1 font-medium text-foreground">{supplier.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Payment terms</dt>
            <dd className="mt-1 font-medium text-foreground">{supplier.payment_terms || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium text-foreground">
              <SupplierStatusBadge status={supplier.status} />
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-[10px] text-muted-foreground">Address</dt>
            <dd className="mt-1 whitespace-pre-wrap font-medium text-foreground">{supplier.address || '—'}</dd>
          </div>
        </dl>
      </section>

      {summary && (
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Unpaid bills" value={money(summary.unpaid_bills)} />
            <Stat
              label="Credit remaining"
              value={money(summary.credit_remaining)}
              hint={
                Number(summary.unacknowledged_credit_remaining || 0) > 0
                  ? `${money(summary.unacknowledged_credit_remaining)} is our own debit notes`
                  : undefined
              }
            />
            <Stat
              label={Number(summary.net_owed) < 0 ? 'Supplier owes us' : 'Net owed to supplier'}
              value={money(Math.abs(Number(summary.net_owed || 0)))}
              tone={Number(summary.net_owed) < 0 ? 'bad' : undefined}
            />
            <Stat label="Returns awaiting outcome" value={String(summary.returns_awaiting_outcome || 0)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${base}/suppliers/${supplier.id}/credits`} className="text-core hover:underline">
              Credits & refunds
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href={`${base}/suppliers/${supplier.id}/credits/new?type=credit_note`} className="text-core hover:underline">
              Record credit note
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href={`${base}/suppliers/${supplier.id}/credits/new?type=debit_note`} className="text-core hover:underline">
              Issue debit note
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href={`${base}/suppliers/${supplier.id}/refunds/new`} className="text-core hover:underline">
              Record refund
            </Link>
          </div>
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="overflow-hidden border border-border rounded-sm bg-card">
          <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
            Returns awaiting outcome
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Return</th>
                  <th className="px-4 py-2 text-left font-medium">Dispatched</th>
                  <th className="px-4 py-2 text-left font-medium">Expecting</th>
                  <th className="px-4 py-2 text-right font-medium">Worth</th>
                  <th className="px-4 py-2 text-right font-medium">Still to recover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {awaiting.map((row) => (
                  <tr key={row.purchase_return}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`${base}/returns/${row.purchase_return}`} className="text-core hover:underline">
                        {row.return_number || 'Return'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.dispatched_at ? new Date(row.dispatched_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{RESOLUTION_LABELS[row.resolution] || row.resolution}</td>
                    <td className="px-4 py-2 text-right">{money(row.value)}</td>
                    <td className="px-4 py-2 text-right">{money(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="overflow-hidden border border-border rounded-sm bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-foreground">
          Purchase orders
        </h2>
        {orders.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No purchase orders with this supplier yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Order</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-2 font-medium text-foreground">
                      <Link
                        href={`${base}/orders/${order.id}`}
                        className="text-core hover:underline"
                      >
                        {order.title || order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(order.total || 0, currentBranch?.base_currency || '')}
                    </td>
                    <td className="px-4 py-2"><OrderStatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Receipts and Bills/Statement have no backing tables yet - this
          module hasn't been built (receiving + billing/AP are future
          work, flagged earlier in this project). Rather than fabricate
          empty tables that look wired up but aren't, these sections are
          left out entirely until there's real data to show. */}
    </div>
  )
}