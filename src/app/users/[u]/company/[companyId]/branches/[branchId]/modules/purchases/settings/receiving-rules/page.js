'use client'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ASSUMPTION: adjust this path to wherever purchase-settings-shared.jsx is placed.
import {
  SettingsPageShell,
  usePurchaseSettingsEditor,
} from '@/components/modules/purchases/purchase-settings-shared'

// Goes at modules/purchases/settings/receiving-rules/page.js.
// Wired to purchase_settings through the shared editor.
//
// Two switches stay disabled whatever the mode (they describe how the
// app already works, not a choice):
//   - partial deliveries: always on (outstanding = ordered - received)
//   - receipts must reference a PO: enforced by a required FK
//
// Over-receipt tolerance and excess handling are SAVED here but the
// receiving code doesn't read them yet - today any amount over
// outstanding is held for approval (compute_purchase_receipt_line_
// discrepancy() is hardcoded). The notes below say so.

const EXCESS_HANDLING_OPTIONS = [
  { value: 'block', label: 'Block — reject the receipt line entirely' },
  { value: 'warn', label: 'Warn — accept in full, flag for review' },
  { value: 'require_approval', label: 'Require approval — hold the excess, post the rest' },
]

export default function ReceivingRulesSettingsPage() {
  const editor = usePurchaseSettingsEditor()
  const { view, patch, editing } = editor

  return (
    <SettingsPageShell
      editor={editor}
      title="Receiving Rules"
      description="Allow partial deliveries; configure over-receipt tolerance; determine whether excess quantities are blocked, warned about or require approval; require receipts to reference eligible purchase orders."
    >
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Allow partial deliveries</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Always on — this follows from outstanding-quantity math, not a setting.
            </p>
          </div>
          <Switch checked disabled />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">
              Require receipts to reference an eligible purchase order
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Always on — enforced at the database level (a required FK), not editable here.
            </p>
          </div>
          <Switch checked disabled />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Over-receipt</h2>

        <label className="block text-xs font-medium text-gray-700">
          Over-receipt tolerance (%)
          <Input
            type="number"
            min="0"
            value={view.over_receipt_tolerance_percent}
            disabled={!editing}
            onChange={(e) => patch('over_receipt_tolerance_percent', e.target.value)}
            className="mt-1 h-auto w-32 text-sm disabled:opacity-100"
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            Saved, but not yet enforced — right now any amount over outstanding is held for
            approval, regardless of this tolerance.
          </span>
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Excess quantity handling
          <Select
            value={view.excess_handling}
            disabled={!editing}
            onValueChange={(value) => patch('excess_handling', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXCESS_HANDLING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            Saved, but the real behavior is still "Require approval" — it changes only once
            compute_purchase_receipt_line_discrepancy() reads this setting.
          </span>
        </label>
      </section>
    </SettingsPageShell>
  )
}