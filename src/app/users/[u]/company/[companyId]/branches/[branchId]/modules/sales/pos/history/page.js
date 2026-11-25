'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

export default function PosHistoryPage() {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('id, sale_number, total, created_at, cashier_label, customers(name), pos_sessions(session_number), pos_sale_payments(method_name, amount)')
        .eq('branch', branchId)
        .order('created_at', { ascending: false })
        .limit(300)
      if (cancelled) return
      if (error) { console.error('Failed to load POS sales:', error); toast.error(error.message || 'Could not load sales.') }
      setRows(data || [])
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [r.sale_number, r.cashier_label, r.customers?.name, r.pos_sessions?.session_number].some((x) => String(x || '').toLowerCase().includes(q)))
  }, [rows, search])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-1">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale, cashier, customer or session" className="pl-8" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Sale</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Cashier</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Paid with</th><th className="px-3 py-2 text-right">Total</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No POS sales yet.</td></tr>
              : filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-3 py-2"><Link href={`${base}/history/${r.id}`} className="font-medium text-core hover:underline">{r.sale_number}</Link><span className="block text-xs text-muted-foreground">{r.pos_sessions?.session_number}</span></td>
                  <td className="px-3 py-2">{formatDateTime(r.created_at, tz)}</td>
                  <td className="px-3 py-2">{r.cashier_label || '—'}</td>
                  <td className="px-3 py-2">{r.customers?.name || 'Walk-in'}</td>
                  <td className="px-3 py-2">{(r.pos_sale_payments || []).map((p) => p.method_name).join(', ')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.total)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
