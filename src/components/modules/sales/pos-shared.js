'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import supabase from '@/config/supabaseClient'

// Shared by the POS pages: branch time zone, date formatting in that zone, and the
// till / payment method / open-session loader.

// Branch time zone (branch_info.timezone, else guessed from the country). Null means "use
// the viewer's own zone", which is what Intl does when timeZone is undefined.
export function useBranchTimezone(branchId) {
  const [tz, setTz] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!branchId) return undefined
    supabase.rpc('branch_timezone', { p_branch: branchId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) console.warn('Branch time zone could not be loaded:', error)
      else setTz(data || null)
    })
    return () => { cancelled = true }
  }, [branchId])
  return tz
}

export function formatDateTime(value, tz) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return d.toLocaleString(undefined, { timeZone: tz || undefined, dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return d.toLocaleString()
  }
}

// Loads what the selling screen needs. On first use at a branch the till and payment
// methods are created (pos_setup).
export function usePosSetup(branchId) {
  const [state, setState] = useState({ loading: true, tills: [], methods: [], settings: null, openSessions: [], userId: null })

  const reload = useCallback(async () => {
    if (!branchId) return
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth?.user?.id || null

      const [tillRes, methodCheck] = await Promise.all([
        supabase.from('pos_tills').select('*').eq('branch', branchId).eq('is_active', true).order('name'),
        supabase.from('pos_payment_methods').select('id').eq('branch', branchId).limit(1),
      ])
      if (tillRes.error) throw tillRes.error
      if (methodCheck.error) throw methodCheck.error
      const tills = tillRes.data || []
      // First use at this branch: the payment methods are created. Tills are not; a manager makes them.
      if ((methodCheck.data || []).length === 0) {
        const { data: setup, error: setupError } = await supabase.rpc('pos_setup', { p_branch: branchId })
        if (setupError) throw setupError
        if (setup && setup.success === false) toast.error(setup.error || 'POS could not be set up for this branch.')
      }

      const [methods, settings, sessions] = await Promise.all([
        supabase.from('pos_payment_methods').select('*').eq('branch', branchId).eq('is_active', true).order('position'),
        supabase.rpc('pos_get_settings', { p_branch: branchId }),
        supabase.from('pos_sessions').select('*').eq('branch', branchId).eq('status', 'open'),
      ])
      if (methods.error) throw methods.error
      if (sessions.error) throw sessions.error

      setState({
        loading: false,
        tills: tills || [],
        methods: methods.data || [],
        settings: settings.data?.success ? settings.data : { default_opening_float: 0, require_difference_reason: true, max_discount_percent: 100 },
        openSessions: sessions.data || [],
        userId,
      })
    } catch (err) {
      console.error('Failed to load POS:', err)
      toast.error(err?.message || 'Could not load POS.')
      setState((s) => ({ ...s, loading: false }))
    }
  }, [branchId])

  useEffect(() => { reload() }, [reload])

  const mySession = state.openSessions.find((s) => s.opened_by === state.userId) || null
  return { ...state, mySession, reload }
}

// The same sum the database does (payments are applied to the total in order; cash may be
// handed over above what is still owed, the rest is change).
export function allocatePayments(rows, methods, total) {
  let remaining = Math.round(Number(total || 0) * 100) / 100
  let change = 0
  let valid = true
  const out = rows.map((row) => {
    const method = methods.find((m) => m.id === row.methodId)
    const entered = Math.round(Number(row.value || 0) * 100) / 100
    let applied = 0
    let tendered = null
    let problem = ''
    if (!method) problem = 'Choose a method'
    else if (!(entered > 0)) problem = 'Enter an amount'
    else if (method.kind === 'cash') {
      applied = Math.min(entered, remaining)
      tendered = entered
      change += entered - applied
      if (applied <= 0) problem = 'Nothing left to pay'
    } else if (entered > remaining + 0.001) {
      problem = 'More than is owed'
    } else {
      applied = entered
    }
    if (method?.requires_reference && !String(row.reference || '').trim()) problem = problem || 'Reference needed'
    remaining = Math.round((remaining - applied) * 100) / 100
    if (problem) valid = false
    return { ...row, method, applied, tendered, problem }
  })
  return { rows: out, remaining, change: Math.round(change * 100) / 100, valid: valid && remaining === 0 && rows.length > 0 }
}