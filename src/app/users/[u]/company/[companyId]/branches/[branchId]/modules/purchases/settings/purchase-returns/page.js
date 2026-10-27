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

// Goes at modules/purchases/settings/purchase-returns/page.js.
// Wired to purchase_settings through the shared editor. These rules are
// enforced by the returns functions in the database (purchase-returns-
// migration.sql and supplier-credits-migration.sql).

const REFERENCE_OPTIONS = [
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'purchase_receipt', label: 'Purchase Receipt' },
  { value: 'either', label: 'Either' },
]

export default function PurchaseReturnsSettingsPage() {
  const editor = usePurchaseSettingsEditor()
  const { view, patch, editing } = editor

  return (
    <SettingsPageShell
      editor={editor}
      title="Purchase Returns"
      description="Configure return approvals, required return references, authorization before dispatch, and whether a refund needs a credit note."
    >
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Require approval for returns</p>
          <Switch
            checked={view.returns_require_approval}
            disabled={!editing}
            onCheckedChange={(checked) => patch('returns_require_approval', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">
            Require authorization before a return is dispatched
          </p>
          <Switch
            checked={view.returns_require_authorization_before_completing}
            disabled={!editing}
            onCheckedChange={(checked) =>
              patch('returns_require_authorization_before_completing', checked)
            }
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Require a credit note for refunds</p>
            <p className="text-[11px] text-gray-500">
              Off (default): a supplier can refund cash with no credit note. On: a refund can only be
              recorded against the supplier's credit note.
            </p>
          </div>
          <Switch
            checked={view.returns_require_credit_note}
            disabled={!editing}
            onCheckedChange={(checked) => patch('returns_require_credit_note', checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Reference requirement</h2>
        <label className="block text-xs font-medium text-gray-700">
          A return must reference a
          <Select
            value={view.returns_required_reference}
            disabled={!editing}
            onValueChange={(value) => patch('returns_required_reference', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </section>
    </SettingsPageShell>
  )
}
