'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import supabase from '@/config/supabaseClient'
import { ErrorNote, useInventoryCan } from '@/components/modules/inventory/receipt-shared'

// Inventory > Settings > Receiving.
//
// The rules the counting door applies when goods arrive. They used to live
// in Purchases settings (Receiving Rules); receiving is now an Inventory job,
// so they live here. Each is a company default that a branch may override.
//   - Over-receipt tolerance: how far above the order a count may go before
//     the extra is treated as excess.
//   - Excess handling: hold it for Purchases to decide, or refuse it.
//   - Delivery note: whether a receipt needs one to be posted.
//   - Sources: where this branch may receive goods from.

const SOURCES = [
  { value: 'purchase_order', label: 'Purchase order', text: 'Goods ordered from a supplier.' },
  { value: 'gift', label: 'Gift or donation', text: 'Goods given to you, with no order behind them.' },
  { value: 'opening_stock', label: 'Opening stock', text: 'Stock counted in when you start using the system. Switch off once that is done.' },
  { value: 'other', label: 'Other', text: 'Anything else; the person says where it came from.' },
]

const EXCESS = [
  {
    value: 'hold',
    label: 'Hold for Purchases',
    text: 'The extra is counted in but kept in quarantine until Purchases decides: accept it onto the order, return it, or decline it.',
  },
  {
    value: 'block',
    label: 'Refuse at the door',
    text: 'A count above the order (plus tolerance) cannot be posted. The person has to reduce it.',
  },
]

const DEFAULTS = {
  over_receipt_tolerance_percent: 0,
  excess_handling: 'hold',
  require_delivery_note: false,
  allowed_receipt_sources: SOURCES.map((entry) => entry.value),
}

const KEYS = Object.keys(DEFAULTS)

export default function ReceivingSettingsPage() {
  const { companyId, branchId } = useParams()
  const canEdit = useInventoryCan('edit')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(DEFAULTS)
  const [savedOverride, setSavedOverride] = useState(false)
  const [branchHasRow, setBranchHasRow] = useState(false)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(DEFAULTS)
  const [override, setOverride] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!branchId || !companyId) return
    setLoading(true)
    setLoadError('')
    const [effectiveResult, rowsResult] = await Promise.all([
      supabase.rpc('get_effective_inventory_settings', { p_branch: branchId }),
      supabase
        .from('inventory_settings')
        .select('branch, over_receipt_tolerance_percent, excess_handling, require_delivery_note, allowed_receipt_sources')
        .eq('company', companyId)
        .eq('branch', branchId),
    ])
    if (effectiveResult.error) {
      setLoadError(effectiveResult.error.message)
      setLoading(false)
      return
    }
    const eff = Array.isArray(effectiveResult.data) ? effectiveResult.data[0] : effectiveResult.data
    const values = {
      over_receipt_tolerance_percent: Number(eff?.over_receipt_tolerance_percent ?? 0),
      excess_handling: eff?.excess_handling || 'hold',
      require_delivery_note: eff?.require_delivery_note === true,
      allowed_receipt_sources: eff?.allowed_receipt_sources || DEFAULTS.allowed_receipt_sources,
    }
    const branchRow = (rowsResult.data || [])[0] || null
    const hasOverride = Boolean(branchRow && KEYS.some((key) => branchRow[key] !== null && branchRow[key] !== undefined))
    setSaved(values)
    setDraft(values)
    setSavedOverride(hasOverride)
    setOverride(hasOverride)
    setBranchHasRow(Boolean(branchRow))
    setLoading(false)
  }, [branchId, companyId])

  useEffect(() => {
    load()
  }, [load])

  const view = editing ? draft : saved
  const patch = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }))

  function toggleSource(value) {
    setDraft((previous) => {
      const has = previous.allowed_receipt_sources.includes(value)
      const next = has
        ? previous.allowed_receipt_sources.filter((entry) => entry !== value)
        : [...previous.allowed_receipt_sources, value]
      return { ...previous, allowed_receipt_sources: next }
    })
  }

  function problem() {
    const tolerance = Number(draft.over_receipt_tolerance_percent)
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) return 'Tolerance must be between 0 and 100 percent.'
    if (draft.allowed_receipt_sources.length === 0) return 'Allow at least one source to receive from.'
    return ''
  }

  async function handleSave() {
    const message = problem()
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    const values = {
      over_receipt_tolerance_percent: Number(draft.over_receipt_tolerance_percent),
      excess_handling: draft.excess_handling,
      require_delivery_note: draft.require_delivery_note,
      allowed_receipt_sources: draft.allowed_receipt_sources,
    }
    // Override on: this branch gets its own values. Override off: what is
    // edited here becomes the company default, and the branch goes back to
    // following it.
    let result = await supabase.rpc('save_inventory_settings', {
      p_company: companyId,
      p_branch: override ? branchId : null,
      p_values: values,
    })
    if (!result.error && !override && branchHasRow) {
      result = await supabase.rpc('save_inventory_settings', {
        p_company: companyId,
        p_branch: branchId,
        p_values: {
          over_receipt_tolerance_percent: null,
          excess_handling: null,
          require_delivery_note: null,
          allowed_receipt_sources: null,
        },
      })
    }
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setEditing(false)
    await load()
  }

  function handleCancel() {
    setDraft(saved)
    setOverride(savedOverride)
    setError('')
    setEditing(false)
  }

  if (loading && !editing) return <p className="text-xs text-gray-500">Loading receiving settings...</p>
  if (loadError) return <div><ErrorNote>{loadError}</ErrorNote></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          The rules applied when goods are counted in: how much over an order is accepted, what happens to the extra, and
          what a receipt needs before it can be posted.
        </p>
        {canEdit && !editing && (
          <Button type="button" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {editing && (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={handleCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Override for this branch</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Off: this branch follows the company defaults, and changes you save here change the company default. On: the
              values on this page apply only to this branch.
            </p>
          </div>
          <Switch checked={override} disabled={!editing} onCheckedChange={setOverride} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Receiving against an order</h2>

        <label className="block text-xs font-medium text-gray-700">
          Over-receipt tolerance (%)
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={view.over_receipt_tolerance_percent}
            disabled={!editing}
            onChange={(event) => patch('over_receipt_tolerance_percent', event.target.value)}
            className="mt-1 h-auto w-32 text-sm disabled:opacity-100"
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            A count up to this far above the quantity ordered is accepted as normal. Ordered 100 with 5% tolerance: up to
            105 is fine, 106 has 1 unit of excess.
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">When there is excess or an unexpected item</p>
          {EXCESS.map((entry) => (
            <label
              key={entry.value}
              className={`flex gap-3 rounded-md border p-3 ${view.excess_handling === entry.value ? 'border-core bg-core/5' : 'border-gray-200'} ${editing ? 'cursor-pointer' : ''}`}
            >
              <input
                type="radio"
                name="excess-handling"
                className="mt-0.5"
                disabled={!editing}
                checked={view.excess_handling === entry.value}
                onChange={() => patch('excess_handling', entry.value)}
              />
              <span>
                <span className="block text-xs font-medium text-gray-900">{entry.label}</span>
                <span className="mt-0.5 block text-[11px] text-gray-600">{entry.text}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Posting a receipt</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Delivery note number required</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              A receipt cannot be posted without the supplier&apos;s delivery note number. Drafts can still be saved without
              one.
            </p>
          </div>
          <Switch
            checked={view.require_delivery_note}
            disabled={!editing}
            onCheckedChange={(checked) => patch('require_delivery_note', checked)}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4">
        <div>
          <h2 className="text-xs font-semibold text-gray-800">Where goods may come from</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">At least one source must stay on.</p>
        </div>
        {SOURCES.map((entry) => {
          const on = view.allowed_receipt_sources.includes(entry.value)
          return (
            <label key={entry.value} className={`flex items-start gap-3 ${editing ? 'cursor-pointer' : ''}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={!editing}
                checked={on}
                onChange={() => toggleSource(entry.value)}
              />
              <span>
                <span className="block text-xs font-medium text-gray-900">{entry.label}</span>
                <span className="block text-[11px] text-gray-500">{entry.text}</span>
              </span>
            </label>
          )
        })}
      </section>
    </div>
  )
}