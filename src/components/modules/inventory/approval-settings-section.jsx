'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import supabase from '@/config/supabaseClient'
import { ErrorNote, useInventoryCan } from '@/components/modules/inventory/receipt-shared'

// Shared by Inventory > Settings > Adjustments & Write-offs and > Transfers.
//
// Two things per page:
//   1. Whether this needs approval. A company default that a branch may
//      override, like every other inventory setting. Off by choice only; if
//      nobody has chosen, approval is ON.
//   2. Who approves. Optional. Left on "Default", the approval engine's own
//      rule applies (anyone at or above the lowest level that can create
//      inventory operations, never the person who made the request). Or pick
//      named people, or whole access levels. Approvers are company-wide.
//
// The engine looks at named people first and ignores levels when both exist,
// so this screen only ever offers one kind at a time.
//
// props:
//   action:      'post_adjustment' | 'post_transfer'  (engine action name)
//   settingKey:  'require_adjustment_approval' | 'require_transfer_approval'
//   noun:        'adjustments' | 'transfers'          (for wording)
//   description: one line under the page's top

const MODES = [
  { value: 'default', label: 'Default', text: 'Anyone at or above the lowest level that can create inventory operations, except the person who made the request. The owner can always approve.' },
  { value: 'staff', label: 'Named people', text: 'Only the people you pick can approve.' },
  { value: 'levels', label: 'Access levels', text: 'Anyone holding one of the access levels you pick can approve, except the person who made the request.' },
]

export default function ApprovalSettingsSection({ action, settingKey, noun, description }) {
  const { companyId, branchId } = useParams()
  const canEdit = useInventoryCan('edit', 'inventory_settings')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [config, setConfig] = useState(null)

  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savedOverride, setSavedOverride] = useState(false)
  const [override, setOverride] = useState(false)
  const [branchHasRow, setBranchHasRow] = useState(false)

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!branchId || !companyId) return
    setLoading(true)
    setLoadError('')
    const [effective, rows, approvals] = await Promise.all([
      supabase.rpc('get_effective_inventory_settings', { p_branch: branchId }),
      supabase.from('inventory_settings').select(`branch, ${settingKey}`).eq('company', companyId).eq('branch', branchId),
      supabase.rpc('get_inventory_approval_config', { p_company: companyId }),
    ])
    const failure = effective.error || approvals.error
    if (failure) {
      setLoadError(failure.message)
      toast.error(failure.message)
      setLoading(false)
      return
    }
    const eff = Array.isArray(effective.data) ? effective.data[0] : effective.data
    const mine = approvals.data?.[action] || {}
    const values = {
      require: eff?.[settingKey] !== false,
      mode: mine.mode || 'default',
      staff_ids: mine.staff_ids || [],
      level_keys: mine.level_keys || [],
      approvals_required: Number(mine.approvals_required || 1),
    }
    const branchRow = (rows.data || [])[0] || null
    const hasOverride = Boolean(branchRow && branchRow[settingKey] !== null && branchRow[settingKey] !== undefined)
    setConfig(approvals.data)
    setSaved(values)
    setDraft(values)
    setSavedOverride(hasOverride)
    setOverride(hasOverride)
    setBranchHasRow(Boolean(branchRow))
    setLoading(false)
  }, [action, branchId, companyId, settingKey])

  useEffect(() => {
    load()
  }, [load])

  const levelName = useMemo(() => {
    const map = {}
    for (const level of config?.levels || []) map[level.key] = level.name || level.key
    return map
  }, [config])

  const patch = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }))
  const toggleIn = (key, value) =>
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((entry) => entry !== value) : [...previous[key], value],
    }))

  function problem() {
    if (draft.mode === 'staff' && draft.staff_ids.length === 0) return 'Pick at least one person, or switch to Default.'
    if (draft.mode === 'levels' && draft.level_keys.length === 0) return 'Pick at least one access level, or switch to Default.'
    const needed = Number(draft.approvals_required)
    if (!Number.isInteger(needed) || needed < 1 || needed > 5) return 'Approvals needed must be a whole number from 1 to 5.'
    if (draft.mode === 'staff' && needed > draft.staff_ids.length) return 'Approvals needed cannot be more than the number of people picked.'
    return ''
  }

  async function handleSave() {
    const message = problem()
    if (message) {
      setError(message)
      toast.error(message)
      return
    }
    setBusy(true)
    setError('')

    let result = await supabase.rpc('save_inventory_settings', {
      p_company: companyId,
      p_branch: override ? branchId : null,
      p_values: { [settingKey]: draft.require },
    })
    if (!result.error && !override && branchHasRow) {
      result = await supabase.rpc('save_inventory_settings', {
        p_company: companyId,
        p_branch: branchId,
        p_values: { [settingKey]: null },
      })
    }
    if (!result.error) {
      result = await supabase.rpc('save_inventory_approval_config', {
        p_company: companyId,
        p_action: action,
        p_mode: draft.mode,
        p_staff: draft.mode === 'staff' ? draft.staff_ids : null,
        p_levels: draft.mode === 'levels' ? draft.level_keys : null,
        p_approvals_required: Number(draft.approvals_required),
      })
    }
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      toast.error(result.error.message)
      return
    }
    toast.success(`Approval settings for ${noun} saved.`)
    setEditing(false)
    await load()
  }

  function handleCancel() {
    setDraft(saved)
    setOverride(savedOverride)
    setError('')
    setEditing(false)
  }

  if (loading && !editing) return <p className="p-6 text-xs text-gray-500">Loading approval settings...</p>
  if (loadError) return <div className="p-6"><ErrorNote>{loadError}</ErrorNote></div>
  if (!draft) return null

  const view = editing ? draft : saved
  const staff = config?.staff || []
  const levels = config?.levels || []

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">{description}</p>
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
              Off: this branch follows the company default, and the switch below changes the company default. On: the switch
              applies only to this branch. The approvers further down are always company-wide.
            </p>
          </div>
          <Switch checked={override} disabled={!editing} onCheckedChange={setOverride} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Require approval for {noun}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              On: nothing changes stock until someone other than the requester approves it. Off: it is posted as soon as it is
              submitted. If nobody has chosen, this is on.
            </p>
          </div>
          <Switch checked={view.require} disabled={!editing} onCheckedChange={(checked) => patch('require', checked)} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4">
        <div>
          <h2 className="text-xs font-semibold text-gray-800">Who approves</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Optional. {view.require ? '' : 'Only used while approval is on. '}Leave on Default to use the standard rule.
          </p>
        </div>

        {MODES.map((entry) => (
          <label
            key={entry.value}
            className={`flex gap-3 rounded-md border p-3 ${view.mode === entry.value ? 'border-core bg-core/5' : 'border-gray-200'} ${editing ? 'cursor-pointer' : ''}`}
          >
            <input
              type="radio"
              name={`approvers-${action}`}
              className="mt-0.5"
              disabled={!editing}
              checked={view.mode === entry.value}
              onChange={() => patch('mode', entry.value)}
            />
            <span>
              <span className="block text-xs font-medium text-gray-900">{entry.label}</span>
              <span className="mt-0.5 block text-[11px] text-gray-600">{entry.text}</span>
            </span>
          </label>
        ))}

        {view.mode === 'staff' && (
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            {staff.length === 0 && <p className="text-[11px] text-gray-500">No staff with a login yet.</p>}
            {staff.map((person) => (
              <label key={person.id} className={`flex items-start gap-3 ${editing ? 'cursor-pointer' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!editing}
                  checked={view.staff_ids.includes(person.id)}
                  onChange={() => toggleIn('staff_ids', person.id)}
                />
                <span>
                  <span className="block text-xs font-medium text-gray-900">{person.name || person.email || 'Unnamed'}</span>
                  <span className="block text-[11px] text-gray-500">
                    {levelName[person.access_level] || person.access_level}
                    {person.status && person.status !== 'active' ? ` · ${person.status}` : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {view.mode === 'levels' && (
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            {levels.map((level) => (
              <label key={level.key} className={`flex items-start gap-3 ${editing ? 'cursor-pointer' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!editing}
                  checked={view.level_keys.includes(level.key)}
                  onChange={() => toggleIn('level_keys', level.key)}
                />
                <span className="text-xs font-medium text-gray-900">{level.name || level.key}</span>
              </label>
            ))}
          </div>
        )}

        <label className="block text-xs font-medium text-gray-700">
          Approvals needed
          <Input
            type="number"
            min={1}
            max={5}
            step="1"
            value={view.approvals_required}
            disabled={!editing}
            onChange={(event) => patch('approvals_required', event.target.value)}
            className="mt-1 h-auto w-24 text-sm disabled:opacity-100"
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            How many different approvers must say yes. Usually 1.
          </span>
        </label>
      </section>
    </div>
  )
}
