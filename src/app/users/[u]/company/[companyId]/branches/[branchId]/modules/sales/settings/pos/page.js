'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Sales Settings > POS. Saved per branch. These three values already drive POS; this page only lets you change them.
export default function SalesPosSettingsPage() {
  const { branchId } = useParams()

  const [opening, setOpening] = useState('0')
  const [reason, setReason] = useState(true)
  const [maxDiscount, setMaxDiscount] = useState('100')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_pos_rules', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the POS settings.'
        console.error('get_pos_rules failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setOpening(String(data.default_opening_float ?? 0))
        setReason(data.require_difference_reason !== false)
        setMaxDiscount(String(data.max_discount_percent ?? 100))
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
    if (opening === '' || Number(opening) < 0) return fail('The opening float cannot be negative.')
    if (maxDiscount === '' || Number(maxDiscount) < 0 || Number(maxDiscount) > 100) return fail('The maximum discount must be between 0 and 100 percent.')
    setSaving(true)
    const { data, error } = await supabase.rpc('save_pos_rules', {
      p_branch: branchId,
      p_values: { default_opening_float: Number(opening), require_difference_reason: reason, max_discount_percent: Number(maxDiscount) },
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the POS settings.'
      console.error('save_pos_rules failed:', error || data)
      return fail(message)
    }
    toast.success('POS settings saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading settings...</p>

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Till</p>
          <label className="block max-w-xs font-medium text-gray-800">
            Default opening float
            <Input type="number" min="0" step="0.01" value={opening} onChange={(event) => setOpening(event.target.value)} className="mt-1 h-8 text-xs" />
            <span className="mt-1 block font-normal text-muted-foreground">The cash a till starts a session with, unless the last closing suggests otherwise.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={reason} onChange={(event) => setReason(event.target.checked)} />
            <span>
              <span className="font-medium text-gray-800">Ask for a reason when the counted cash differs</span>
              <span className="mt-0.5 block text-muted-foreground">Applies when a cashier closes a session and the count does not match.</span>
            </span>
          </label>
        </div>

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Discounts at the till</p>
          <p className="text-muted-foreground">Only people with the price-edit permission can discount at POS, and never by more than this. This limit is separate from the one on pro formas and invoices.</p>
          <label className="block max-w-xs font-medium text-gray-800">
            Maximum discount (%)
            <Input type="number" min="0" max="100" step="0.1" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} className="mt-1 h-8 text-xs" />
          </label>
        </div>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>
    </form>
  )
}
