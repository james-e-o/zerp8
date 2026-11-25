'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Sales Settings > Delivery. Saved per branch. 0 means "exactly the ordered quantity".
export default function SalesDeliverySettingsPage() {
  const { branchId } = useParams()

  const [over, setOver] = useState('0')
  const [under, setUnder] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_delivery_rules', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the delivery settings.'
        console.error('get_delivery_rules failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setOver(String(data.delivery_over_tolerance_pct ?? 0))
        setUnder(String(data.delivery_under_tolerance_pct ?? 0))
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
    if (over === '' || Number(over) < 0 || Number(over) > 100) return fail('Over-delivery must be between 0 and 100 percent.')
    if (under === '' || Number(under) < 0 || Number(under) >= 100) return fail('Under-delivery must be at least 0 and below 100 percent.')

    setSaving(true)
    const { data, error } = await supabase.rpc('save_delivery_rules', {
      p_branch: branchId,
      p_values: { delivery_over_tolerance_pct: Number(over), delivery_under_tolerance_pct: Number(under) },
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the delivery settings.'
      console.error('save_delivery_rules failed:', error || data)
      return fail(message)
    }
    toast.success('Delivery settings saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading settings...</p>

  const example = 100
  const maxQty = example * (1 + (Number(over) || 0) / 100)
  const minQty = example * (1 - (Number(under) || 0) / 100)

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Delivery tolerance</p>
          <p className="text-muted-foreground">
            Real deliveries are not always exact. These two numbers say how much difference from the ordered quantity is acceptable. Leave both at 0 to deliver exactly what was ordered.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block font-medium text-gray-800">
              Over-delivery allowed (%)
              <Input type="number" min="0" max="100" step="0.1" value={over} onChange={(event) => setOver(event.target.value)} className="mt-1 h-8 text-xs" />
              <span className="mt-1 block font-normal text-muted-foreground">How far above the ordered quantity a delivery may go.</span>
            </label>
            <label className="block font-medium text-gray-800">
              Under-delivery accepted (%)
              <Input type="number" min="0" max="99.9" step="0.1" value={under} onChange={(event) => setUnder(event.target.value)} className="mt-1 h-8 text-xs" />
              <span className="mt-1 block font-normal text-muted-foreground">How far below the ordered quantity still counts as fully delivered.</span>
            </label>
          </div>
          <p className="rounded-sm bg-muted/50 p-2 text-muted-foreground">
            Example: if a customer orders {example}, you may hand over up to {Number(maxQty.toFixed(2))}, and the order counts as fully delivered once {Number(minQty.toFixed(2))} or more has gone out.
          </p>
          <p className="text-muted-foreground">Changes apply to deliveries made from now on.</p>
        </div>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>
    </form>
  )
}