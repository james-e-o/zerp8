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

import {
  SettingsPageShell,
  usePurchaseSettingsEditor,
} from '@/components/modules/procurement/purchase-settings-shared'

// Goes at modules/purchases/settings/supplier-bills/page.js (replaces the old
// placeholder page). Wired to purchase_settings through the shared editor.
// The rules are enforced by create_purchase_bill / update_purchase_bill in
// the database (purchase-bill-approval-migration.sql).

const ACTION_OPTIONS = [
  { value: 'warn', label: 'Warn: save the bill and flag it' },
  { value: 'block', label: 'Block: do not allow the bill to be saved' },
  { value: 'require_approval', label: 'Require approval: save it as Pending approval' },
]

const ACTION_HELP = {
  warn: 'The bill is saved normally and the price difference is shown to whoever entered it.',
  block: 'A bill priced outside the tolerance cannot be saved. The price has to be corrected first.',
  require_approval:
    'The bill is saved as Pending approval. It cannot be paid or have credit applied until an approver approves it and it is confirmed. The company owner is never held up by this.',
}

export default function SupplierBillsSettingsPage() {
  const editor = usePurchaseSettingsEditor()
  const { view, patch, editing } = editor

  return (
    <SettingsPageShell
      editor={editor}
      title="Supplier Bills"
      description="Supplier invoice rules, how a bill's price is checked against its purchase order, and whether goods must be received before a bill can be entered."
    >
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Require supplier invoice number</p>
          <Switch
            checked={view.require_supplier_invoice_number}
            disabled={!editing}
            onCheckedChange={(checked) => patch('require_supplier_invoice_number', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Prevent duplicate supplier invoices</p>
          <Switch
            checked={view.prevent_duplicate_invoice_numbers}
            disabled={!editing}
            onCheckedChange={(checked) => patch('prevent_duplicate_invoice_numbers', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Require goods to be received before billing</p>
            <p className="text-[11px] text-gray-500">
              Off (default): a bill can be entered before delivery, for example when a supplier asks to
              be paid first. On: a bill line cannot be for more than has been received on that order
              line so far. Either way, a bill can never be for more than was ordered.
            </p>
          </div>
          <Switch
            checked={view.bills_require_receipt}
            disabled={!editing}
            onCheckedChange={(checked) => patch('bills_require_receipt', checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Price check</h2>

        <label className="block text-xs font-medium text-gray-700">
          Price tolerance (%)
          <Input
            type="number"
            min="0"
            value={view.bills_price_tolerance_percent}
            disabled={!editing}
            onChange={(e) => patch('bills_price_tolerance_percent', e.target.value)}
            className="mt-1 h-auto text-sm disabled:opacity-100"
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            How far a billed price may differ from the purchase order price, up or down, before the
            action below applies.
          </span>
        </label>

        <label className="block text-xs font-medium text-gray-700">
          When a bill is outside the tolerance
          <Select
            value={view.bills_tolerance_action}
            disabled={!editing}
            onValueChange={(value) => patch('bills_tolerance_action', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            {ACTION_HELP[view.bills_tolerance_action]}
          </span>
        </label>
      </section>
    </SettingsPageShell>
  )
}
