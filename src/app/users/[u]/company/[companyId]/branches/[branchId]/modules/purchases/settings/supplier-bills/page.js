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

// Goes at modules/purchases/settings/supplier-bills/page.js.
// Wired to purchase_settings through the shared editor.
//
// Supplier Bills now exists, and create_purchase_bill() reads these
// settings (after purchase-bills-hardening-migration.sql):
//   - matching mode + quantity/price tolerances + what to do when a bill
//     is outside them (warn / block / require approval)
//   - require supplier invoice number; prevent duplicate invoice numbers
// "Allow bills with no Purchase Order" is shown off and locked: a bill
// always starts from a Purchase Order (settled design), so it isn't a
// choice.

const MATCHING_OPTIONS = [
  { value: 'none', label: 'None — bills are not matched against anything' },
  { value: 'two_way', label: '2-way — Purchase Order + Bill' },
  { value: 'three_way', label: '3-way — Purchase Order + Receipt + Bill' },
]

const TOLERANCE_ACTION_OPTIONS = [
  { value: 'warn', label: 'Warn — save the bill, flag it for review' },
  { value: 'block', label: 'Block — refuse to save the bill' },
  { value: 'require_approval', label: 'Require approval — needs an approved request first' },
]

export default function SupplierBillsSettingsPage() {
  const editor = usePurchaseSettingsEditor()
  const { view, patch, editing } = editor

  return (
    <SettingsPageShell
      editor={editor}
      title="Supplier Bills"
      description="Require supplier invoice numbers, prevent duplicate supplier invoices, configure PO-and-receipt matching, and set what happens when a bill's price or quantity is outside tolerance."
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
          <div>
            <p className="text-xs font-medium text-gray-800">Prevent duplicate supplier invoices</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              The same invoice number can't be billed twice for one supplier (cancelled bills
              don't count).
            </p>
          </div>
          <Switch
            checked={view.prevent_duplicate_invoice_numbers}
            disabled={!editing}
            onCheckedChange={(checked) => patch('prevent_duplicate_invoice_numbers', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Allow bills with no Purchase Order</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Always off — a bill always starts from a Purchase Order.
            </p>
          </div>
          <Switch checked={false} disabled />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Matching</h2>

        <label className="block text-xs font-medium text-gray-700">
          PO-and-receipt matching
          <Select
            value={view.bills_matching_mode}
            disabled={!editing}
            onValueChange={(value) => patch('bills_matching_mode', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCHING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-xs font-medium text-gray-700">
            Price discrepancy tolerance (%)
            <Input
              type="number"
              min="0"
              value={view.bills_price_tolerance_percent ?? ''}
              disabled={!editing}
              onChange={(e) => patch('bills_price_tolerance_percent', e.target.value)}
              className="mt-1 h-auto text-sm disabled:opacity-100"
            />
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              How far a billed price may differ from the Purchase Order price.
            </span>
          </label>

          <label className="block text-xs font-medium text-gray-700">
            Quantity discrepancy tolerance (%)
            <Input
              type="number"
              min="0"
              value={view.bills_quantity_tolerance_percent ?? ''}
              disabled={!editing}
              onChange={(e) => patch('bills_quantity_tolerance_percent', e.target.value)}
              className="mt-1 h-auto text-sm disabled:opacity-100"
            />
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              How far billed quantity may run ahead of what's been received (3-way only).
              Billing more than was ordered is never allowed.
            </span>
          </label>
        </div>

        <label className="block text-xs font-medium text-gray-700">
          When a bill is outside tolerance
          <Select
            value={view.bills_tolerance_action}
            disabled={!editing}
            onValueChange={(value) => patch('bills_tolerance_action', value)}
          >
            <SelectTrigger className="mt-1 h-auto w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOLERANCE_ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-1 block text-[11px] font-normal text-gray-500">
            "Require approval" uses an approval policy for (module, purchase_bills,
            create_over_tolerance) — until the company owner sets one up, only the owner can
            save an out-of-tolerance bill.
          </span>
        </label>
      </section>
    </SettingsPageShell>
  )
}