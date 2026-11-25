'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Sales Settings > Discounts & margin. Saved per branch. Applies to pro formas and sales invoices
// (quotations and orders carry no discount). POS keeps its own limit in the POS tab.
const ACTIONS = [
  ['warn', 'Warn, but allow the document to be saved'],
  ['block', 'Block: the document cannot be saved'],
  ['allow', 'Allow: do not check the margin'],
]

export default function SalesDiscountSettingsPage() {
  const { branchId } = useParams()

  const [maxDiscount, setMaxDiscount] = useState('100')
  const [action, setAction] = useState('warn')
  const [minMargin, setMinMargin] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_discount_rules', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the discount settings.'
        console.error('get_discount_rules failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setMaxDiscount(String(data.max_discount_percent ?? 100))
        setAction(data.margin_breach_action || 'warn')
        setMinMargin(data.default_min_margin_percentage == null ? '' : String(data.default_min_margin_percentage))
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
    if (maxDiscount === '' || Number(maxDiscount) < 0 || Number(maxDiscount) > 100) return fail('The maximum discount must be between 0 and 100 percent.')
    if (minMargin !== '' && Number(minMargin) < 0) return fail('The minimum margin cannot be negative.')

    setSaving(true)
    const { data, error } = await supabase.rpc('save_discount_rules', {
      p_branch: branchId,
      p_values: { max_discount_percent: Number(maxDiscount), margin_breach_action: action, default_min_margin_percentage: minMargin === '' ? null : Number(minMargin) },
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the discount settings.'
      console.error('save_discount_rules failed:', error || data)
      return fail(message)
    }
    toast.success('Discount settings saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading settings...</p>

  const cost = 100
  const floor = minMargin === '' ? null : cost * (1 + Number(minMargin) / 100)

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Maximum discount</p>
          <p className="text-muted-foreground">
            The most a single line, or a whole pro forma or invoice, may be discounted. People who hold the price-edit permission may go above it. Leave at 100 for no limit.
          </p>
          <label className="block max-w-xs font-medium text-gray-800">
            Maximum discount (%)
            <Input type="number" min="0" max="100" step="0.1" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} className="mt-1 h-8 text-xs" />
          </label>
        </div>

        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Minimum margin</p>
          <p className="text-muted-foreground">
            After a discount, the price must still cover the product&apos;s cost plus this margin. A product&apos;s own minimum (set on the product) wins over this branch default. The check runs only on documents that carry a discount, and uses the branch&apos;s current average cost.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block font-medium text-gray-800">
              Branch default minimum margin (% on cost)
              <Input type="number" min="0" step="0.1" value={minMargin} onChange={(event) => setMinMargin(event.target.value)} placeholder="None" className="mt-1 h-8 text-xs" />
            </label>
            <div className="block font-medium text-gray-800">
              When it is not met
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map(([value, label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {floor != null && (
            <p className="rounded-sm bg-muted/50 p-2 text-muted-foreground">
              Example: an item that costs {cost} may not be sold below {Number(floor.toFixed(2))} after discount.
            </p>
          )}
          <p className="text-muted-foreground">POS always blocks a sale under the minimum margin, whatever is chosen here.</p>
        </div>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>
    </form>
  )
}
