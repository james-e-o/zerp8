'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// This is the "General" tab's content - goes at the SETTINGS ROOT:
// modules/purchases/settings/page.js (not a general/ subfolder - see
// the note in settings-layout.jsx on why the General tab has no path
// suffix).
//
// UI ONLY, local state, no backend - same scope note as the rest of
// this batch. Edit is in-place (view <-> edit on this one page), not
// a separate route.
//
// PageHeader (title "Purchases Settings" + the tab nav) already
// renders above this via the shared layout, so this page does NOT
// repeat a big page title - it only shows this tab's own description
// and content, matching what TabNav's active tab already tells the
// person they're looking at.

const defaultSettings = {
  branchOverrideEnabled: false,
  requestNumberFormat: 'PR-{YY}{MM}{DD}-{RAND}',
  orderNumberFormat: 'PO-{YY}{MM}{DD}-{RAND}',
  receiptNumberFormat: 'RCT-{YY}{MM}{DD}-{RAND}',
  purchaseRequestsEnabled: true,
  purchaseReturnsEnabled: true,
}

export default function GeneralPurchasesSettingsPage() {
  const [saved, setSaved] = useState(defaultSettings)
  const [draft, setDraft] = useState(defaultSettings)
  const [editing, setEditing] = useState(false)

  const startEdit = () => {
    setDraft(saved)
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft(saved)
    setEditing(false)
  }
  const handleSave = () => {
    setSaved(draft)
    setEditing(false)
  }

  const view = editing ? draft : saved
  const patch = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          Default purchasing preferences, document numbering, and which purchasing workflows are
          enabled.
        </p>
        {!editing ? (
          <Button type="button" variant="outline" className="h-7 shrink-0 text-xs" onClick={startEdit}>
            Edit
          </Button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button type="button" className="bg-core hover:bg-core/80 h-7 text-xs text-white" onClick={handleSave}>
              Save
            </Button>
          </div>
        )}
      </div>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Override for this branch</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Off: this branch follows the company-wide defaults below. On: the values on this
              page apply only to this branch.
            </p>
          </div>
          <Switch
            checked={view.branchOverrideEnabled}
            disabled={!editing}
            onCheckedChange={(checked) => patch('branchOverrideEnabled', checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Document numbering</h2>

        <label className="block text-xs font-medium text-gray-700">
          Purchase Request number format
          <Input
            value={view.requestNumberFormat}
            disabled={!editing}
            onChange={(e) => patch('requestNumberFormat', e.target.value)}
            className="mt-1 h-auto text-sm disabled:opacity-100"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Purchase Order number format
          <Input
            value={view.orderNumberFormat}
            disabled={!editing}
            onChange={(e) => patch('orderNumberFormat', e.target.value)}
            className="mt-1 h-auto text-sm disabled:opacity-100"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Receipt number format
          <Input
            value={view.receiptNumberFormat}
            disabled={!editing}
            onChange={(e) => patch('receiptNumberFormat', e.target.value)}
            className="mt-1 h-auto text-sm disabled:opacity-100"
          />
        </label>

        <p className="text-[11px] text-gray-400">
          {'{YY}'} {'{MM}'} {'{DD}'} and {'{RAND}'} are placeholders, display-only for now -
          Requests, Orders and Receipts still self-generate their numbers in code, not from this
          setting.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Workflows enabled</h2>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Purchase Requests</p>
          <Switch
            checked={view.purchaseRequestsEnabled}
            disabled={!editing}
            onCheckedChange={(checked) => patch('purchaseRequestsEnabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Purchase Returns</p>
          <Switch
            checked={view.purchaseReturnsEnabled}
            disabled={!editing}
            onCheckedChange={(checked) => patch('purchaseReturnsEnabled', checked)}
          />
        </div>
      </section>
    </div>
  )
}