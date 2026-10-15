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
// Wired to purchase_settings through the shared editor. Saved only: the
// purchase_returns table exists, but the Returns pages (and these rules)
// aren't built, so the toggles change nothing until that work happens.

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
      description="Configure return approvals, required return references and whether a return needs authorization before it can be completed."
    >
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        The Returns pages aren't built yet, so these are saved but don't change anything until
        they are.
      </p>

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
            Require authorization before a return is completed
          </p>
          <Switch
            checked={view.returns_require_authorization_before_completing}
            disabled={!editing}
            onCheckedChange={(checked) =>
              patch('returns_require_authorization_before_completing', checked)
            }
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