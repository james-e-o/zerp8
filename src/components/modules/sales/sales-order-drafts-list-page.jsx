'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { computeTotals, formatDate, useMoney } from '@/components/modules/sales/quotation-shared'

// Order drafts: one JSONB row per draft in sales_order_drafts. A quotation's "Convert to order"
// and a cancelled order's "Duplicate" both land here. Opening one goes to the New Order form
// with ?draft=<id>. Orders carry no discount (discounts start on the pro forma / invoice), so the total here ignores any old draft discount.
export default function SalesOrderDraftsListPage() {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('sales_order_drafts')
      .select('id, title, payload, updated_at')
      .eq('branch', branchId)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Failed to load order drafts:', error)
      setErrorMessage(error.message || 'Could not load drafts.')
      toast.error(error.message || 'Could not load drafts.')
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (branchId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const { error } = await supabase.from('sales_order_drafts').delete().eq('id', toDelete.id).eq('branch', branchId)
    setDeleting(false)
    if (error) {
      console.error('Failed to delete draft:', error)
      toast.error(error.message || 'Could not delete the draft.')
      return
    }
    toast.success('Draft deleted.')
    setToDelete(null)
    load()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-3 text-xs">
      {loading ? (
        <p className="text-muted-foreground">Loading drafts...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : rows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No draft orders.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Draft</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Items</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Last saved</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const p = row.payload || {}
                const items = Array.isArray(p.items) ? p.items.filter((item) => item.variantId) : []
                const totals = computeTotals(items, 'amount', 0, p.applyVat !== false, p.vatRate ?? 0)
                return (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <Link href={`${base}/new?draft=${row.id}`} className="font-medium text-foreground hover:text-core">{row.title || 'Untitled order'}</Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.quotationNumber ? `Quotation ${p.quotationNumber}` : p.duplicatedFromNumber ? `Order ${p.duplicatedFromNumber}` : '—'}</td>
                    <td className="px-4 py-2 text-right">{items.length}</td>
                    <td className="px-4 py-2 text-right">{money(totals.total)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(row.updated_at)}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setToDelete(row)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Delete draft"
                        title="Delete draft"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => { if (!open && !deleting) setToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.title || 'This draft'} will be removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmDelete() }} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
