'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import supabase from '@/config/supabaseClient'
import { ErrorNote, useInventoryCan } from '@/components/modules/inventory/receipt-shared'

// Inventory > Settings > General (settings/page.js; the General tab has no
// path suffix).
//
// Document numbering. Receipts are numbered from this format as soon as it is
// saved. Adjustments and transfers will use the same mechanism when those
// pages are built, and will appear here then.

const DEFAULT_FORMAT = 'RCT-{YY}{MM}{DD}-{RAND}'

function preview(format) {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const pad = (n) => String(n).padStart(2, '0')
  return (format || DEFAULT_FORMAT)
    .replaceAll('{YYYY}', yyyy)
    .replaceAll('{YY}', yyyy.slice(2))
    .replaceAll('{MM}', pad(now.getMonth() + 1))
    .replaceAll('{DD}', pad(now.getDate()))
    .replaceAll('{RAND}', 'A3F9')
}

export default function GeneralInventorySettingsPage() {
  const { companyId, branchId } = useParams()
  const canEdit = useInventoryCan('edit')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(DEFAULT_FORMAT)
  const [savedOverride, setSavedOverride] = useState(false)
  const [branchHasRow, setBranchHasRow] = useState(false)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_FORMAT)
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
        .select('receipt_number_format')
        .eq('company', companyId)
        .eq('branch', branchId),
    ])
    if (effectiveResult.error) {
      setLoadError(effectiveResult.error.message)
      setLoading(false)
      return
    }
    const eff = Array.isArray(effectiveResult.data) ? effectiveResult.data[0] : effectiveResult.data
    const format = eff?.receipt_number_format || DEFAULT_FORMAT
    const branchRow = (rowsResult.data || [])[0] || null
    const hasOverride = Boolean(branchRow?.receipt_number_format)
    setSaved(format)
    setDraft(format)
    setSavedOverride(hasOverride)
    setOverride(hasOverride)
    setBranchHasRow(Boolean(branchRow))
    setLoading(false)
  }, [branchId, companyId])

  useEffect(() => {
    load()
  }, [load])

  const view = editing ? draft : saved

  function problem() {
    const value = draft.trim()
    if (!/^[A-Za-z0-9_/{}-]{1,40}$/.test(value)) {
      return 'Use letters, digits and - _ / only, up to 40 characters, with the placeholders below.'
    }
    if (!value.includes('{RAND}')) return 'The format must include {RAND}, so two receipts never share a number.'
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
    // Override on: this branch gets its own format. Override off: what is
    // edited here becomes the company default, and the branch goes back to
    // following it.
    let result = await supabase.rpc('save_inventory_settings', {
      p_company: companyId,
      p_branch: override ? branchId : null,
      p_values: { receipt_number_format: draft.trim() },
    })
    if (!result.error && !override && branchHasRow) {
      result = await supabase.rpc('save_inventory_settings', {
        p_company: companyId,
        p_branch: branchId,
        p_values: { receipt_number_format: null },
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

  if (loading && !editing) return <p className="text-xs text-gray-500">Loading settings...</p>
  if (loadError) return <div><ErrorNote>{loadError}</ErrorNote></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">How inventory documents are numbered.</p>
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
              Off: this branch follows the company default, and changes you save here change the company default. On: the
              format applies only to this branch.
            </p>
          </div>
          <Switch checked={override} disabled={!editing} onCheckedChange={setOverride} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Document numbering</h2>

        <label className="block text-xs font-medium text-gray-700">
          Receipt number format
          <Input
            value={view}
            disabled={!editing}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-1 h-auto font-mono text-sm disabled:opacity-100"
          />
        </label>

        <p className="text-xs text-gray-700">
          Next receipt looks like <span className="font-mono font-medium">{preview(view)}</span>
        </p>

        <p className="text-[11px] text-gray-500">
          Placeholders: {'{YY}'} two-digit year, {'{YYYY}'} four-digit year, {'{MM}'} month, {'{DD}'} day, and {'{RAND}'} four
          random letters or digits ({'{RAND}'} is required). Changing the format affects new receipts only; existing numbers
          stay as they are.
        </p>
      </section>
    </div>
  )
}
