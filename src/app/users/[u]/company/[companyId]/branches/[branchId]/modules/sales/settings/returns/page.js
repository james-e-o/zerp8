'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PAYMENT_METHODS } from '@/components/modules/sales/invoice-shared'

// Sales Settings > Returns. Saved per branch.
export default function SalesReturnsSettingsPage() {
  const { branchId } = useParams()

  const [days, setDays] = useState('')
  const [approval, setApproval] = useState(true)
  const [method, setMethod] = useState('bank_transfer')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_return_rules', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the returns settings.'
        console.error('get_return_rules failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setDays(data.returns_window_days == null ? '' : String(data.returns_window_days))
        setApproval(data.returns_require_approval !== false)
        setMethod(data.default_refund_method || 'bank_transfer')
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const fail = (message) => {
    setErrorMessage(message)
    toast.error(message)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (days !== '' && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650)) {
      return fail('The return window must be a whole number of days from 1 to 3650, or empty for no limit.')
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('save_return_rules', {
      p_branch: branchId,
      p_values: { returns_window_days: days === '' ? null : Number(days), returns_require_approval: approval, default_refund_method: method },
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the returns settings.'
      console.error('save_return_rules failed:', error || data)
      return fail(message)
    }
    toast.success('Returns settings saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading settings...</p>

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Return window</p>
          <p className="text-muted-foreground">How long after delivery a customer may return goods. Leave empty to accept returns at any time.</p>
          <label className="block max-w-xs font-medium text-gray-800">
            Days after delivery
            <Input type="number" min="1" max="3650" step="1" value={days} onChange={(event) => setDays(event.target.value)} placeholder="No limit" className="mt-1 h-8 text-xs" />
          </label>
        </div>

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Approval</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={approval} onChange={(event) => setApproval(event.target.checked)} />
            <span>
              <span className="font-medium text-gray-800">A return must be approved before the goods come back</span>
              <span className="mt-0.5 block text-muted-foreground">When this is off, a return is approved automatically by the person who raises it.</span>
            </span>
          </label>
        </div>

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Refund method</p>
          <p className="text-muted-foreground">Pre-selected when someone records a refund (on an invoice, or of a customer advance). It can still be changed on the form.</p>
          <div className="max-w-xs">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((entry) => <SelectItem key={entry.value} value={entry.value} className="text-xs">{entry.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>
    </form>
  )
}
