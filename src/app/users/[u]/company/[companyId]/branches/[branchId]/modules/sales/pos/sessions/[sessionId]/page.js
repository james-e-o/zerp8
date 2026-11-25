'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

export default function PosSessionDetailPage() {
  const { u, companyId, branchId, sessionId } = useParams()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [counts, setCounts] = useState([])
  const [sales, setSales] = useState([])
  const [moves, setMoves] = useState([])

  const load = useCallback(async () => {
    const [s, sm, c, sl, mv] = await Promise.all([
      supabase.from('pos_sessions').select('*, pos_tills(name)').eq('id', sessionId).maybeSingle(),
      supabase.rpc('pos_session_summary', { p_session: sessionId }),
      supabase.from('pos_session_counts').select('*').eq('session', sessionId),
      supabase.from('pos_sales').select('id, sale_number, total, created_at, cashier_label').eq('session', sessionId).order('created_at', { ascending: false }),
      supabase.from('pos_cash_moves').select('*').eq('session', sessionId).order('created_at', { ascending: false }),
    ])
    const err = s.error || sm.error || c.error || sl.error || mv.error
    if (err) { console.error('Failed to load session:', err); toast.error(err.message || 'Could not load the session.') }
    setSession(s.data || null)
    setSummary(sm.data?.success ? sm.data : null)
    setCounts(c.data || [])
    setSales(sl.data || [])
    setMoves(mv.data || [])
    setLoading(false)
  }, [sessionId])

  useEffect(() => { load() }, [load])

  // ----- closing -----
  const [closeOpen, setCloseOpen] = useState(false)
  const [counted, setCounted] = useState({})
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)

  const cashDiff = (summary?.expected || [])
    .filter((e) => e.kind === 'cash' && counted[e.method] !== undefined && counted[e.method] !== '')
    .reduce((sum, e) => sum + (Number(counted[e.method]) - Number(e.expected)), 0)
  const cashCounted = (summary?.expected || []).filter((e) => e.kind === 'cash').every((e) => counted[e.method] !== undefined && counted[e.method] !== '')

  const closeSession = async () => {
    setClosing(true)
    const payload = (summary?.expected || []).map((e) => ({ method: e.method, counted: counted[e.method] === undefined || counted[e.method] === '' ? null : Number(counted[e.method]) }))
    const { data, error } = await supabase.rpc('pos_close_session', { p_session: sessionId, p_counts: payload, p_note: note })
    setClosing(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not close the session.'
      console.error('Close session failed:', message); toast.error(message); return
    }
    toast.success('Session closed and locked.')
    setCloseOpen(false); setLoading(true); load()
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading session...</div>
  if (!session) return <div className="p-6 text-sm text-muted-foreground">Session not found.</div>
  const open = session.status === 'open'

  return (
    <div className="h-full space-y-3 overflow-y-auto px-1 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`${base}/sessions`} className="text-sm text-core hover:underline">← Sessions</Link>
          <h2 className="text-base font-semibold">{session.session_number} · {session.pos_tills?.name} <span className="ml-1 text-sm font-normal text-muted-foreground">{open ? 'Open' : 'Closed and locked'}</span></h2>
          <p className="text-xs text-muted-foreground">
            Opened {formatDateTime(session.opened_at, tz)} by {session.opened_by_label || '—'}
            {session.closed_at ? ` · Closed ${formatDateTime(session.closed_at, tz)} by ${session.closed_by_label || '—'}` : ''}
          </p>
        </div>
        {open && <Button onClick={() => { setCounted({}); setNote(''); setCloseOpen(true) }}>Close session</Button>}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ['Opening float', money(session.opening_float)],
          ['Sales', `${summary?.sales_count ?? sales.length} · ${money(summary?.sales_total ?? 0)}`],
          ['Cash in / out', `${money(summary?.cash_in ?? 0)} / ${money(summary?.cash_out ?? 0)}`],
          ['Over / short', session.over_short === null ? '—' : money(session.over_short)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-semibold tabular-nums">{value}</p></div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-sm font-semibold">{open ? 'Expected now' : 'Closing count'}</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="px-3 py-1.5">Method</th><th className="px-3 py-1.5 text-right">Expected</th>{!open && <><th className="px-3 py-1.5 text-right">Counted</th><th className="px-3 py-1.5 text-right">Difference</th></>}</tr></thead>
          <tbody>
            {open ? (summary?.expected || []).map((e) => (
              <tr key={e.method} className="border-t border-border"><td className="px-3 py-1.5">{e.name}</td><td className="px-3 py-1.5 text-right tabular-nums">{money(e.expected)}</td></tr>
            )) : counts.map((c) => (
              <tr key={c.id} className="border-t border-border"><td className="px-3 py-1.5">{c.method_name}</td><td className="px-3 py-1.5 text-right tabular-nums">{money(c.expected)}</td><td className="px-3 py-1.5 text-right tabular-nums">{c.counted === null ? '—' : money(c.counted)}</td><td className={`px-3 py-1.5 text-right tabular-nums ${Number(c.difference) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{c.difference === null ? '—' : money(c.difference)}</td></tr>
            ))}
          </tbody>
        </table>
        {session.closing_note && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Note: {session.closing_note}</p>}
      </div>

      <div className="rounded-md border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-sm font-semibold">Sales in this session</p>
        {sales.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No sales yet.</p> : (
          <table className="w-full text-sm"><tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-border first:border-t-0 hover:bg-muted/50">
                <td className="px-3 py-1.5"><Link href={`${base}/history/${s.id}`} className="font-medium text-core hover:underline">{s.sale_number}</Link></td>
                <td className="px-3 py-1.5">{formatDateTime(s.created_at, tz)}</td>
                <td className="px-3 py-1.5">{s.cashier_label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(s.total)}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>

      {moves.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <p className="border-b border-border px-3 py-2 text-sm font-semibold">Cash movements</p>
          <table className="w-full text-sm"><tbody>
            {moves.map((m) => (
              <tr key={m.id} className="border-t border-border first:border-t-0">
                <td className="px-3 py-1.5">{m.kind === 'cash_in' ? 'Cash in' : 'Cash out'}</td>
                <td className="px-3 py-1.5">{m.reason}</td>
                <td className="px-3 py-1.5">{formatDateTime(m.created_at, tz)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(m.amount)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      <Dialog open={closeOpen} onOpenChange={(o) => { if (!closing) setCloseOpen(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close {session.session_number}</DialogTitle>
            <DialogDescription>Count what is in the till. Once closed, this session is locked and cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(summary?.expected || []).map((e) => (
              <label key={e.method} className="block text-sm">
                <span className="font-medium">{e.name}{e.kind === 'cash' ? ' (required)' : ' (optional)'}</span>
                <span className="ml-2 text-xs text-muted-foreground">expected {money(e.expected)}</span>
                <Input type="number" min="0" step="0.01" value={counted[e.method] ?? ''} onChange={(ev) => setCounted((c) => ({ ...c, [e.method]: ev.target.value }))} className="mt-1" />
              </label>
            ))}
            {cashCounted && Math.round(cashDiff * 100) !== 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">Cash is {money(Math.abs(cashDiff))} {cashDiff < 0 ? 'short' : 'over'}. Explain the difference below.</p>
            )}
            <Input placeholder="Note (required if the cash does not match)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={closing} onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button disabled={closing || !cashCounted} onClick={closeSession}>{closing ? 'Closing...' : 'Close session'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
