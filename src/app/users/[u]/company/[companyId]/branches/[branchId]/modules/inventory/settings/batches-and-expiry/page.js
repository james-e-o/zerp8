'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import supabase from '@/config/supabaseClient'
import { ErrorNote, useInventoryCan } from '@/components/modules/inventory/receipt-shared'

// Inventory > Settings > Batch & Expiry.
//
// Rules for goods that carry an expiry date. Both are company defaults that a
// branch may override.
//   - Expiry warning: how many days ahead the Batches list flags a batch as
//     "expiring soon". Used today.
//   - Block expired stock: whether expired goods may be picked or sold. It is
//     saved now and applies as soon as picking and delivery are built.

const DEFAULTS = { block_expired_stock: true, expiry_alert_days: 30 }
const KEYS = Object.keys(DEFAULTS)

export default function BatchExpirySettingsPage() {
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
        .select('block_expired_stock, expiry_alert_days')
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
      block_expired_stock: eff?.block_expired_stock !== false,
      expiry_alert_days: Number(eff?.expiry_alert_days ?? DEFAULTS.expiry_alert_days),
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

  async function handleSave() {
    const days = Number(draft.expiry_alert_days)
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      setError('Enter a whole number of days, 0 or more.')
      return
    }
    setBusy(true)
    setError('')
    // Override on: this branch gets its own values. Override off: what is
    // edited here becomes the company default, and the branch goes back to
    // following it.
    let result = await supabase.rpc('save_inventory_settings', {
      p_company: companyId,
      p_branch: override ? branchId : null,
      p_values: { block_expired_stock: draft.block_expired_stock, expiry_alert_days: days },
    })
    if (!result.error && !override && branchHasRow) {
      result = await supabase.rpc('save_inventory_settings', {
        p_company: companyId,
        p_branch: branchId,
        p_values: { block_expired_stock: null, expiry_alert_days: null },
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

  if (loading && !editing) return <p className="text-xs text-gray-500">Loading batch and expiry settings...</p>
  if (loadError) return <div><ErrorNote>{loadError}</ErrorNote></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">How the branch treats goods that carry an expiry date.</p>
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
        <h2 className="text-xs font-semibold text-gray-800">Expiry</h2>

        <label className="block text-xs font-medium text-gray-700">
          Warn this many days before expiry
          <Input
            type="number"
            min={0}
            max={3650}
            step="1"
            value={view.expiry_alert_days}
            disabled={!editing}
            onChange={(event) => patch('expiry_alert_days', event.target.value)}
            className="mt-1 h-auto w-32 text-sm disabled:opacity-100"
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            A batch with this many days or fewer left is flagged as expiring soon on the Stock &gt; Batches list.
          </span>
        </label>

        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Block expired stock</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Expired goods cannot be picked or sold. Nothing is deleted: they stay on the books until written off. This
              takes effect once picking and delivery are built; the choice is kept until then.
            </p>
          </div>
          <Switch
            checked={view.block_expired_stock}
            disabled={!editing}
            onCheckedChange={(checked) => patch('block_expired_stock', checked)}
          />
        </div>
      </section>
    </div>
  )
}