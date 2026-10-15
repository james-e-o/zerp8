'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import supabase from '@/config/supabaseClient'

// ASSUMPTION: adjust this path to wherever purchase-settings-shared.jsx is placed.
import {
  SettingsPageShell,
  usePurchaseSettingsEditor,
} from '@/components/modules/purchases/purchase-settings-shared'

// Goes at modules/purchases/settings/requests-approvals/page.js.
// Wired to purchase_settings + purchase_approval_limits through the
// shared editor (withLimits): the settings and the limit list are saved
// together, under one approval check.
//
// Approval limits are real rows now: each one names an actual access
// level (picked from the access_level table, not typed free-hand) and the
// most that level can approve alone. Blank amount = no limit. Saved, but
// not yet enforced - the Requests pages don't read the limits or the
// "require approval" switch yet (the notes say so).
//
// "Who may convert an approved request into a PO" keeps the earlier
// option list; the real conversion check is permission-based and doesn't
// read this setting yet.

const CONVERT_ROLE_OPTIONS = [
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'purchasing_admin', label: 'Purchasing Admin' },
  { value: 'company_owner', label: 'Company Owner' },
  { value: 'any_with_permission', label: 'Any staff with Purchase Orders: edit' },
]

export default function RequestsApprovalsSettingsPage() {
  const editor = usePurchaseSettingsEditor({ withLimits: true })
  const { view, patch, editing, limits } = editor

  const [accessLevels, setAccessLevels] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadAccessLevels() {
      const { data, error } = await supabase.from('access_level').select('*')
      if (cancelled) return
      if (error) {
        console.error('Could not load access levels:', error)
        return
      }
      setAccessLevels(
        (data || []).map((level) => ({
          key: level.key,
          label: level.name || level.label || level.title || level.key,
        }))
      )
    }

    loadAccessLevels()
    return () => {
      cancelled = true
    }
  }, [])

  const labelFor = (key) => accessLevels.find((level) => level.key === key)?.label || key

  return (
    <SettingsPageShell
      editor={editor}
      title="Requests & Approvals"
      description="Enable or disable purchase requests, set approval requirements, define approval limits, and control who may convert an approved request into a PO."
    >
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Purchase Requests enabled</p>
          <Switch
            checked={view.purchase_requests_enabled}
            disabled={!editing}
            onCheckedChange={(checked) => patch('purchase_requests_enabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Require approval on requests</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Saved, but not yet enforced — the Requests pages don't read this yet.
            </p>
          </div>
          <Switch
            checked={view.requests_require_approval}
            disabled={!editing}
            onCheckedChange={(checked) => patch('requests_require_approval', checked)}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-800">Approval limits</h2>
          {editing && (
            <Button
              type="button"
              variant="outline"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={editor.addLimit}
            >
              <Plus className="h-3 w-3" /> Add limit
            </Button>
          )}
        </div>
        <p className="text-[11px] text-gray-500">
          The most each access level can approve on its own. Leave the amount blank for no limit.
          Saved, but not yet enforced by the Requests pages.
        </p>

        <div className="space-y-2">
          {limits.map((limit) => (
            <div key={limit.id} className="flex items-center gap-2">
              {editing ? (
                <Select
                  value={limit.access_level_key}
                  onValueChange={(value) => editor.updateLimit(limit.id, 'access_level_key', value)}
                >
                  <SelectTrigger className="h-auto flex-1 text-sm">
                    <SelectValue placeholder="Access level" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((level) => (
                      <SelectItem key={level.key} value={level.key}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={labelFor(limit.access_level_key)}
                  disabled
                  className="h-auto flex-1 text-sm disabled:opacity-100"
                />
              )}
              <Input
                type="number"
                min="0"
                value={limit.max_amount}
                disabled={!editing}
                placeholder="No limit"
                onChange={(e) => editor.updateLimit(limit.id, 'max_amount', e.target.value)}
                className="h-auto w-36 text-sm disabled:opacity-100"
              />
              {editing && (
                <button
                  type="button"
                  onClick={() => editor.removeLimit(limit.id)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  aria-label="Remove limit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {limits.length === 0 && (
            <p className="text-xs text-gray-400">No approval limits configured.</p>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Conversion to Purchase Order</h2>
        <label className="block text-xs font-medium text-gray-700">
          Who may convert an approved request into a PO
          <Select
            value={view.convert_to_po_role}
            disabled={!editing}
            onValueChange={(value) => patch('convert_to_po_role', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONVERT_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            Saved, but conversion is still controlled by permissions, not this setting.
          </span>
        </label>
      </section>
    </SettingsPageShell>
  )
}