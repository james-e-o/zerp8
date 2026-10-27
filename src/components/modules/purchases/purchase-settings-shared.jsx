'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

import supabase from '@/config/supabaseClient'

// One shared editor for every Purchase Settings tab, so the five tabs
// that save to purchase_settings don't each carry their own copy of the
// load / override / approval-gate / save logic. Suggested location:
//   components/modules/purchases/purchase-settings-shared.jsx
// (requires purchase-settings-defaults-migration.sql to be run).
//
// A tab page is then just its fields:
//
//   const editor = usePurchaseSettingsEditor()
//   return (
//     <SettingsPageShell editor={editor} title="..." description="...">
//       <section>... editor.view.some_field / editor.patch('some_field', v) ...</section>
//     </SettingsPageShell>
//   )
//
// Pass { withLimits: true } for the one tab (Requests & Approvals) that
// also edits the approval-limit list; limits are then saved in the same
// call as the settings, under the same single approval check.
//
// BRANCH OVERRIDE vs COMPANY DEFAULT - same rules as the General tab:
//   - A branch with no override row shows the company defaults. Edit then
//     saves to the COMPANY default, which goes through the approval
//     engine: owner always allowed; others only once the owner has
//     configured an approval policy for (module, purchase_settings, edit)
//     - and then Save submits a request, and you save again once it's
//     approved (the approval clears that one exact edit, once).
//   - "Override for this branch" ON saves this branch's own copy (ordinary
//     branch permission, no approval). OFF deletes it and the branch
//     follows the company default again.
//
// WHERE THE VALUES COME FROM: get_effective_purchase_settings() resolves
// every item branch -> company -> the application defaults
// (purchase_settings_defaults), so the page always receives a complete set.
// A company or branch row only stores the items someone actually changed:
// saving sends all the page's values, and the database keeps only those
// that differ from what the item would follow anyway. Switching the branch
// override on therefore starts an empty override - everything still
// follows the company until a change is saved here.

// A placeholder shown only until the real values load. It is NOT the source
// of truth - the application defaults live in the database table
// purchase_settings_defaults.
export const SETTINGS_DEFAULTS = {
  request_number_format: 'PR-{YY}{MM}{DD}-{RAND}',
  order_number_format: 'PO-{YY}{MM}{DD}-{RAND}',
  receipt_number_format: 'RCT-{YY}{MM}{DD}-{RAND}',
  purchase_requests_enabled: true,
  purchase_returns_enabled: true,
  require_approval_before_issuing: false,
  allow_estimated_cost_prices: true,
  allow_editing_issued_orders: true,
  allow_cancelling_issued_orders: true,
  requests_require_approval: true,
  convert_to_po_role: 'branch_manager',
  over_receipt_tolerance_percent: 0,
  excess_handling: 'require_approval',
  receiving_quarantine_required: true,
  require_supplier_invoice_number: true,
  prevent_duplicate_invoice_numbers: true,
  bills_matching_mode: 'three_way',
  bills_price_tolerance_percent: 0,
  bills_quantity_tolerance_percent: 0,
  allow_non_po_bills: false,
  returns_require_approval: true,
  returns_required_reference: 'either',
  returns_require_authorization_before_completing: true,
  returns_require_credit_note: false,
  bills_tolerance_action: 'warn',
}

// Only real values replace the placeholder: a null/undefined field in the
// response must never blank a toggle or select.
const withDefaults = (row) => {
  const merged = { ...SETTINGS_DEFAULTS }
  Object.entries(row || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) merged[key] = value
  })
  return merged
}

// Number fields are typed into text inputs, so they can be '' or negative
// while someone is typing. What gets saved is always a number of 0 or more.
const NUMERIC_KEYS = [
  'over_receipt_tolerance_percent',
  'bills_price_tolerance_percent',
  'bills_quantity_tolerance_percent',
]
const cleanPayload = (draft) => {
  const cleaned = { ...draft }
  NUMERIC_KEYS.forEach((key) => {
    const value = Number(cleaned[key])
    cleaned[key] = Number.isFinite(value) && value > 0 ? value : 0
  })
  return cleaned
}

// [{ access_level_key, max_amount }] as the database expects it. Blank
// rows are dropped; a blank amount means "no limit".
const limitsPayload = (limits) =>
  (limits || [])
    .filter((limit) => limit.access_level_key)
    .map((limit) => ({
      access_level_key: limit.access_level_key,
      max_amount: limit.max_amount === '' || limit.max_amount == null ? null : Number(limit.max_amount),
    }))

let nextLocalId = 1
const withLocalIds = (rows) =>
  (rows || []).map((row) => ({
    id: row.id || `local-${nextLocalId++}`,
    access_level_key: row.access_level_key,
    max_amount: row.max_amount == null ? '' : String(row.max_amount),
  }))

export function usePurchaseSettingsEditor({ withLimits = false } = {}) {
  const { companyId, branchId } = useParams()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [hasOverride, setHasOverride] = useState(false)
  const [saved, setSaved] = useState(SETTINGS_DEFAULTS)
  const [draft, setDraft] = useState(SETTINGS_DEFAULTS)
  const [savedLimits, setSavedLimits] = useState([])
  const [draftLimits, setDraftLimits] = useState([])
  const [editing, setEditing] = useState(false)

  // 'allowed' | 'needs_approval' | 'owner_only' | null (not known yet)
  const [companyEditGate, setCompanyEditGate] = useState(null)
  const [pendingRequestId, setPendingRequestId] = useState(null)

  const loadLimits = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_effective_purchase_approval_limits', {
      p_branch: branchId,
    })
    if (error) throw error
    return withLocalIds(data)
  }, [branchId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError('')

      try {
        const { data: effective, error: effectiveError } = await supabase.rpc(
          'get_effective_purchase_settings',
          { p_branch: branchId }
        )
        if (effectiveError) throw effectiveError
        if (cancelled) return

        const row = withDefaults(effective)
        setHasOverride(!!effective?.branch)
        setSaved(row)
        setDraft(row)

        if (withLimits) {
          const limits = await loadLimits()
          if (cancelled) return
          setSavedLimits(limits)
          setDraftLimits(limits)
        }

        const { data: gate, error: gateError } = await supabase.rpc('check_approval_gate', {
          p_company: companyId,
          p_category: 'module',
          p_scope_key: 'purchase_settings',
          p_permission_key: 'edit',
        })
        if (!cancelled && !gateError) {
          if (gate === 'allowed') setCompanyEditGate('allowed')
          else if (gate === 'needs_approval') setCompanyEditGate('needs_approval')
          else setCompanyEditGate('owner_only') // 'no_policy' or 'blocked'
        }
      } catch (err) {
        console.error('Failed to load Purchase Settings:', err)
        if (!cancelled) setLoadError(err.message || 'Could not load Purchase Settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [companyId, branchId, withLimits, loadLimits])

  const startEdit = () => {
    setDraft(saved)
    setDraftLimits(savedLimits)
    setSubmitError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(saved)
    setDraftLimits(savedLimits)
    setSubmitError('')
    setEditing(false)
  }

  const patch = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  const addLimit = () =>
    setDraftLimits((prev) => [
      ...prev,
      { id: `local-${nextLocalId++}`, access_level_key: '', max_amount: '' },
    ])
  const updateLimit = (id, field, value) =>
    setDraftLimits((prev) => prev.map((limit) => (limit.id === id ? { ...limit, [field]: value } : limit)))
  const removeLimit = (id) => setDraftLimits((prev) => prev.filter((limit) => limit.id !== id))

  const limitsArgument = (limits) => (withLimits ? { p_limits: limitsPayload(limits) } : {})

  const handleSave = async () => {
    setSaving(true)
    setSubmitError('')

    try {
      if (hasOverride) {
        const { data, error } = await supabase.rpc('upsert_purchase_settings_branch_override', {
          p_branch: branchId,
          p_payload: cleanPayload(draft),
          ...limitsArgument(draftLimits),
        })
        if (error) throw error
        setSaved(withDefaults(data))
        if (withLimits) setSavedLimits(draftLimits)
      } else if (companyEditGate === 'needs_approval') {
        const { data: requestId, error } = await supabase.rpc('submit_approval_request', {
          p_company: companyId,
          p_branch: null,
          p_category: 'module',
          p_scope_key: 'purchase_settings',
          p_permission_key: 'edit',
          p_action_payload: withLimits
            ? { ...cleanPayload(draft), approval_limits: limitsPayload(draftLimits) }
            : cleanPayload(draft),
        })
        if (error) throw error
        setPendingRequestId(requestId)
        setEditing(false)
        setSaving(false)
        return
      } else {
        const { data, error } = await supabase.rpc('upsert_purchase_settings_company_default', {
          p_company: companyId,
          p_payload: cleanPayload(draft),
          ...limitsArgument(draftLimits),
        })
        if (error) throw error
        setSaved(withDefaults(data))
        if (withLimits) setSavedLimits(draftLimits)
      }

      setEditing(false)
    } catch (err) {
      console.error('Error saving Purchase Settings:', err)
      setSubmitError(err.message || 'Something went wrong saving these settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleOverride = async (checked) => {
    setSaving(true)
    setSubmitError('')

    try {
      if (checked) {
        const { data, error } = await supabase.rpc('upsert_purchase_settings_branch_override', {
          p_branch: branchId,
          p_payload: saved,
          ...limitsArgument(savedLimits),
        })
        if (error) throw error
        setSaved(withDefaults(data))
        setHasOverride(true)
      } else {
        const { error } = await supabase.rpc('delete_purchase_settings_branch_override', {
          p_branch: branchId,
        })
        if (error) throw error

        const { data: effective } = await supabase.rpc('get_effective_purchase_settings', {
          p_branch: branchId,
        })
        const row = withDefaults(effective)
        setHasOverride(false)
        setSaved(row)
        setDraft(row)

        if (withLimits) {
          const limits = await loadLimits()
          setSavedLimits(limits)
          setDraftLimits(limits)
        }
      }
    } catch (err) {
      console.error('Error changing branch override:', err)
      setSubmitError(err.message || 'Could not change the branch override.')
    } finally {
      setSaving(false)
    }
  }

  return {
    loading,
    loadError,
    saving,
    submitError,
    hasOverride,
    editing,
    view: editing ? draft : saved,
    limits: editing ? draftLimits : savedLimits,
    canEdit: hasOverride || companyEditGate === 'allowed' || companyEditGate === 'needs_approval',
    companyEditGate,
    pendingRequestId,
    saveLabel:
      saving ? 'Saving...' : hasOverride || companyEditGate === 'allowed' ? 'Save' : 'Request approval to save',
    startEdit,
    cancelEdit,
    patch,
    addLimit,
    updateLimit,
    removeLimit,
    handleSave,
    handleToggleOverride,
  }
}

/**
 * The common frame of a settings tab: title + description, Edit / Save /
 * Cancel, the approval and error messages, and the "Override for this
 * branch" switch. The tab's own sections go in as children.
 */
export function SettingsPageShell({ editor, title, description, children }) {
  if (editor.loading) {
    return <p className="p-6 text-xs text-gray-400">Loading Purchase Settings...</p>
  }
  if (editor.loadError) {
    return <p className="p-6 text-xs text-red-600">{editor.loadError}</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {!editor.editing ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            disabled={!editor.canEdit}
            onClick={editor.startEdit}
          >
            Edit
          </Button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={editor.cancelEdit}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-core hover:bg-core/80 h-7 text-xs text-white"
              disabled={editor.saving}
              onClick={editor.handleSave}
            >
              {editor.saveLabel}
            </Button>
          </div>
        )}
      </div>

      {editor.submitError && <p className="text-xs text-red-600">{editor.submitError}</p>}

      {editor.pendingRequestId && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Your change was submitted for approval and isn't saved yet. Once it's approved, come back
          and save it again — the approval clears you to make this exact edit once.
        </p>
      )}

      {!editor.hasOverride && editor.companyEditGate === 'owner_only' && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          Only the company owner can edit the company-wide defaults right now — no approval policy
          has been configured for this yet. Turn on "Override for this branch" below to set your
          own values for just this branch instead.
        </p>
      )}

      <section className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Override for this branch</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Off: this branch follows the company-wide settings. On: changes you save on any
              Purchase Settings tab apply only to this branch; anything you don't change still
              follows the company.
            </p>
          </div>
          <Switch
            checked={editor.hasOverride}
            disabled={editor.saving || editor.editing || !editor.canEdit}
            onCheckedChange={editor.handleToggleOverride}
          />
        </div>
      </section>

      {children}
    </div>
  )
}
