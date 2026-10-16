'use client'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// ASSUMPTION: adjust this path to wherever purchase-settings-shared.jsx is placed.
import {
  SettingsPageShell,
  usePurchaseSettingsEditor,
} from '@/components/modules/purchases/purchase-settings-shared'

// Goes at modules/purchases/settings/purchase-orders/page.js.
// Wired to purchase_settings through the shared editor - same branch-
// override / approval rules as the General tab.
//
// Saved but NOT yet enforced by the order pages (storing the choice is
// all that's built): requiring approval before issuing, and blocking
// edits/cancels of an issued order. The notes under each switch say so.

export default function PurchaseOrdersSettingsPage() {
  const editor = usePurchaseSettingsEditor()
  const { view, patch, editing } = editor

  return (
    <SettingsPageShell
      editor={editor}
      title="Purchase Orders"
      description="Require approval before issuing an order; allow estimated cost prices; control whether issued orders can be edited or cancelled; configure order numbering."
    >
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Issuing</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Require approval before issuing an order</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Not yet enforced — a PO currently goes straight to "open" with no approval step.
            </p>
          </div>
          <Switch
            checked={view.require_approval_before_issuing}
            disabled={!editing}
            onCheckedChange={(checked) => patch('require_approval_before_issuing', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-gray-800">Allow estimated cost prices</p>
          <Switch
            checked={view.allow_estimated_cost_prices}
            disabled={!editing}
            onCheckedChange={(checked) => patch('allow_estimated_cost_prices', checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">After issuing</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Allow editing an issued order</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Not yet enforced — nothing currently blocks editing a "sent"/"open" order.
            </p>
          </div>
          <Switch
            checked={view.allow_editing_issued_orders}
            disabled={!editing}
            onCheckedChange={(checked) => patch('allow_editing_issued_orders', checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-800">Allow cancelling an issued order</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Not yet enforced — nothing currently blocks cancelling an issued order.
            </p>
          </div>
          <Switch
            checked={view.allow_cancelling_issued_orders}
            disabled={!editing}
            onCheckedChange={(checked) => patch('allow_cancelling_issued_orders', checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-800">Numbering</h2>
        <label className="block text-xs font-medium text-gray-700">
          Order number format
          <Input
            value={view.order_number_format ?? ''}
            disabled={!editing}
            onChange={(e) => patch('order_number_format', e.target.value)}
            className="mt-1 h-auto text-sm disabled:opacity-100"
          />
        </label>
        <p className="text-[11px] text-gray-400">
          Same setting as on the General tab. Orders still generate their numbers in code, not from
          this format, for now.
        </p>
      </section>
    </SettingsPageShell>
  )
}