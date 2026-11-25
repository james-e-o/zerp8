'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

export default function PosSessionsPage() {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('pos_sessions')
        .select('id, session_number, status, opened_by_label, opened_at, closed_at, opening_float, over_short, pos_tills(name)')
        .eq('branch', branchId)
        .order('opened_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) { console.error('Failed to load sessions:', error); toast.error(error.message || 'Could not load sessions.') }
      setRows(data || [])
      setLoading(false)
    }
    if (branchId) load()
    return () => { cancelled = true }
  }, [branchId])

  return (
    <div className="h-full overflow-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr><th className="px-3 py-2">Session</th><th className="px-3 py-2">Till</th><th className="px-3 py-2">Opened by</th><th className="px-3 py-2">Opened</th><th className="px-3 py-2">Closed</th><th className="px-3 py-2 text-right">Over / short</th><th className="px-3 py-2">Status</th></tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No sessions yet.</td></tr>
            : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-3 py-2"><Link href={`${base}/sessions/${r.id}`} className="font-medium text-core hover:underline">{r.session_number}</Link></td>
                <td className="px-3 py-2">{r.pos_tills?.name}</td>
                <td className="px-3 py-2">{r.opened_by_label || '—'}</td>
                <td className="px-3 py-2">{formatDateTime(r.opened_at, tz)}</td>
                <td className="px-3 py-2">{r.closed_at ? formatDateTime(r.closed_at, tz) : '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${Number(r.over_short) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{r.over_short === null ? '—' : money(r.over_short)}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{r.status === 'open' ? 'Open' : 'Closed'}</span></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
