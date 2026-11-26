'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import supabase from '@/config/supabaseClient'

// Products > Settings > Pricing
// Two company-wide defaults. Any product can override either one on its own edit page.
//   1. How a product's cost estimate follows supplier bills.
//   2. What happens to the selling price when the cost estimate changes.
// A company that has never saved here uses the application defaults
// (last bill, automatic). Saving creates the company's own row.

const COST_MODES = [
  { value: 'last_bill', label: 'Last bill', text: 'The estimate becomes the price on the latest supplier bill. Example: you last paid 350, so the estimate is 350.' },
  { value: 'stock_average', label: 'Average on hand', text: 'The estimate is the average cost of the stock you hold now.' },
  { value: 'highest', label: 'Highest on hand', text: 'The estimate is the highest cost among the stock you hold now.' },
  { value: 'lowest', label: 'Lowest on hand', text: 'The estimate is the lowest cost among the stock you hold now.' },
  { value: 'manual', label: 'Manual', text: 'The estimate never changes by itself. Products whose latest bill differs from it appear on the Cost estimates page for someone to decide.' },
]

const PRICE_MODES = [
  { value: 'auto', label: 'Automatic', text: 'The selling price is recalculated from the new cost and the margin on the product, and applied straight away. Every change is recorded in Price changes.' },
  { value: 'review', label: 'Review first', text: 'The new price waits on the Suggested prices page. Nothing changes until someone approves it.' },
  { value: 'locked', label: 'Locked', text: 'The selling price never changes because of a cost change.' },
]

export default function PricingSettingsPage() {
  const { branchId } = useParams()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState({ cost_update_policy: 'last_bill', default_reprice_mode: 'auto', tolerance_percent: '1' })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data, error } = await supabase.rpc('get_costing_policy', { p_branch: branchId })
      if (error) throw error
      setSaved(data)
      setDraft({
        cost_update_policy: data.cost_update_policy,
        default_reprice_mode: data.default_reprice_mode,
        tolerance_percent: String(data.tolerance_percent ?? 1),
      })
    } catch (error) {
      console.error('Failed to load pricing settings:', error)
      setLoadError(error?.message || 'Could not load the pricing settings.')
      toast.error(error?.message || 'Could not load the pricing settings.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    if (branchId) load()
  }, [branchId, load])

  const dirty = saved && (
    draft.cost_update_policy !== saved.cost_update_policy
    || draft.default_reprice_mode !== saved.default_reprice_mode
    || Number(draft.tolerance_percent) !== Number(saved.tolerance_percent)
  )

  async function save() {
    const tolerance = Number(draft.tolerance_percent)
    if (draft.tolerance_percent === '' || !Number.isFinite(tolerance) || tolerance < 0) {
      toast.error('Enter the tolerance as a number, 0 or more.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_costing_policy', {
        p_branch: branchId,
        p_policy: {
          cost_update_policy: draft.cost_update_policy,
          default_reprice_mode: draft.default_reprice_mode,
          tolerance_percent: tolerance,
        },
      })
      if (error) throw error
      toast.success('Pricing settings saved.')
      await load()
    } catch (error) {
      console.error('Failed to save pricing settings:', error)
      toast.error(error?.message || 'Could not save the pricing settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !saved) return <p className="p-6 text-xs text-gray-500">Loading pricing settings...</p>
  if (loadError && !saved) return <p className="p-6 text-xs text-red-600">{loadError}</p>

  const costMode = COST_MODES.find((m) => m.value === draft.cost_update_policy)
  const priceMode = PRICE_MODES.find((m) => m.value === draft.default_reprice_mode)

  return (
    <div className="max-w-3xl space-y-4 p-1 text-xs">
      <div className="rounded-md border border-border bg-card p-3 text-muted-foreground">
        These are company-wide defaults. A single product can follow its own rule instead: open the product, choose
        Edit, and look under Pricing for the variant.
        {saved && !saved.is_saved ? ' Nothing has been saved yet, so the application defaults are in use.' : ''}
      </div>

      <section className="space-y-2 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">When a supplier bill arrives, the cost estimate</h2>
        <Select value={draft.cost_update_policy} onValueChange={(v) => setDraft((p) => ({ ...p, cost_update_policy: v }))}>
          <SelectTrigger className="h-8 max-w-xs text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COST_MODES.map((m) => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-gray-500">{costMode?.text}</p>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">When the cost estimate changes, the selling price</h2>
        <Select value={draft.default_reprice_mode} onValueChange={(v) => setDraft((p) => ({ ...p, default_reprice_mode: v }))}>
          <SelectTrigger className="h-8 max-w-xs text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRICE_MODES.map((m) => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-gray-500">{priceMode?.text}</p>
        <p className="text-[11px] text-gray-500">
          Only products that have a margin set are repriced. Switching to Automatic needs the permission to change selling prices.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Tolerance</h2>
        <div className="flex items-center gap-2">
          <Input
            type="number" min="0" step="0.01"
            value={draft.tolerance_percent}
            onChange={(e) => setDraft((p) => ({ ...p, tolerance_percent: e.target.value }))}
            className="h-8 w-24 text-xs"
          />
          <span className="text-gray-600">%</span>
        </div>
        <p className="text-[11px] text-gray-500">
          For products on Manual, the Cost estimates page lists a product only when its latest bill differs from the
          estimate by more than this.
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving || !dirty} onClick={load}>
          Reset
        </Button>
        <Button type="button" className="h-8 bg-core text-xs text-white hover:bg-core/80" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}