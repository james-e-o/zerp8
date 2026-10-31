'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import supabase from '@/config/supabaseClient'
import { formatDate } from '@/components/modules/inventory/inventory-shared'
import { ErrorNote, Tone, useInventoryCan } from '@/components/modules/inventory/receipt-shared'

// Inventory > Settings > Costing.
//
// Two different things live here:
//   1. The costing METHOD. One per company, never per branch and never per
//      product. The owner must confirm it before the first receipt, and it is
//      locked for good once any branch posts its first stock movement.
//   2. Pricing basis and the negative-stock rule. Company defaults that a
//      branch may override for itself.

const METHODS = [
  {
    value: 'fifo',
    label: 'First in, first out (FIFO)',
    text: 'Stock is costed at what the oldest goods actually cost. If you bought 10 at 100 and then 10 at 120, the first 10 you sell cost 100 each.',
  },
  {
    value: 'weighted_average',
    label: 'Weighted average',
    text: 'All of a branch’s stock of a product shares one average cost, recalculated at every receipt. 10 at 100 plus 10 at 120 makes every unit cost 110.',
  },
]

const PRICING_BASES = [
  { value: 'latest_receipt_cost', label: 'Latest receipt cost' },
  { value: 'average_cost', label: 'Average cost' },
  { value: 'oldest_layer_cost', label: 'Oldest layer cost (FIFO)' },
  { value: 'cost_estimate', label: 'Cost estimate on the product' },
]

const NEGATIVE_POLICIES = [
  { value: 'block', label: 'Block the sale', text: 'Stock can never go below zero.' },
  { value: 'warn', label: 'Warn, then allow', text: 'The person is warned and may continue.' },
  { value: 'allow', label: 'Allow', text: 'Sales go through; stock may go below zero.' },
]

export default function CostingSettingsPage() {
  const { companyId, branchId } = useParams()
  const canEdit = useInventoryCan('edit','inventory_settings')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [effective, setEffective] = useState(null)
  const [companyRow, setCompanyRow] = useState(null)
  const [branchRow, setBranchRow] = useState(null)

  // Method section
  const [pickedMethod, setPickedMethod] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [methodBusy, setMethodBusy] = useState(false)
  const [methodError, setMethodError] = useState('')
  const [methodSaved, setMethodSaved] = useState(false)

  // Rules section (view <-> edit in place)
  const [editing, setEditing] = useState(false)
  const [override, setOverride] = useState(false)
  const [draft, setDraft] = useState({ pricing_cost_basis: 'latest_receipt_cost', negative_stock_policy: 'block' })
  const [rulesBusy, setRulesBusy] = useState(false)
  const [rulesError, setRulesError] = useState('')

  const load = useCallback(async () => {
    if (!branchId || !companyId) return
    setLoading(true)
    setLoadError('')
    const [effectiveResult, rowsResult] = await Promise.all([
      supabase.rpc('get_effective_inventory_settings', { p_branch: branchId }),
      supabase
        .from('inventory_settings')
        .select('branch, costing_method, costing_locked_at, costing_confirmed_at, pricing_cost_basis, negative_stock_policy')
        .eq('company', companyId),
    ])
    if (effectiveResult.error) {
      setLoadError(effectiveResult.error.message)
      setLoading(false)
      return
    }
    const eff = Array.isArray(effectiveResult.data) ? effectiveResult.data[0] : effectiveResult.data
    const rows = rowsResult.data || []
    const company = rows.find((row) => row.branch === null) || null
    const branch = rows.find((row) => row.branch === branchId) || null
    setEffective(eff)
    setCompanyRow(company)
    setBranchRow(branch)
    setOverride(Boolean(branch && (branch.pricing_cost_basis || branch.negative_stock_policy)))
    setDraft({
      pricing_cost_basis: eff?.pricing_cost_basis || 'latest_receipt_cost',
      negative_stock_policy: eff?.negative_stock_policy || 'block',
    })
    setLoading(false)
  }, [branchId, companyId])

  useEffect(() => {
    load()
  }, [load])

  const confirmed = Boolean(effective?.costing_confirmed)
  const locked = Boolean(effective?.costing_locked)

  async function saveMethod(confirm) {
    setMethodBusy(true)
    setMethodError('')
    setMethodSaved(false)
    const values = { costing_method: pickedMethod }
    if (confirm) values.confirm_costing_method = true
    const { error } = await supabase.rpc('save_inventory_settings', {
      p_company: companyId,
      p_branch: null,
      p_values: values,
    })
    setMethodBusy(false)
    if (error) {
      setMethodError(error.message)
      return
    }
    setUnderstood(false)
    setMethodSaved(true)
    await load()
  }

  async function saveRules() {
    setRulesBusy(true)
    setRulesError('')
    // Override on: branch values. Override off: the branch goes back to the
    // company defaults, and what is edited here is the company default.
    const args = override
      ? { p_company: companyId, p_branch: branchId, p_values: { ...draft } }
      : { p_company: companyId, p_branch: null, p_values: { ...draft } }
    let result = await supabase.rpc('save_inventory_settings', args)
    if (!result.error && !override && branchRow) {
      result = await supabase.rpc('save_inventory_settings', {
        p_company: companyId,
        p_branch: branchId,
        p_values: { pricing_cost_basis: null, negative_stock_policy: null },
      })
    }
    setRulesBusy(false)
    if (result.error) {
      setRulesError(result.error.message)
      return
    }
    setEditing(false)
    await load()
  }

  function cancelRules() {
    setDraft({
      pricing_cost_basis: effective?.pricing_cost_basis || 'latest_receipt_cost',
      negative_stock_policy: effective?.negative_stock_policy || 'block',
    })
    setOverride(Boolean(branchRow && (branchRow.pricing_cost_basis || branchRow.negative_stock_policy)))
    setRulesError('')
    setEditing(false)
  }

  if (loading && !effective) return <p className="p-6 text-xs text-gray-500">Loading costing settings...</p>
  if (loadError) return <div className="p-6"><ErrorNote>{loadError}</ErrorNote></div>

  const currentMethod = METHODS.find((method) => method.value === effective?.costing_method)
  const basisLabel = PRICING_BASES.find((entry) => entry.value === draft.pricing_cost_basis)?.label
  const policy = NEGATIVE_POLICIES.find((entry) => entry.value === draft.negative_stock_policy)

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <p className="text-xs text-gray-500">
        How stock is valued, which cost prices are based on, and what happens when stock runs out.
      </p>

      {/* 1. Method */}
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-800">Costing method</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              One method for the whole company. It does not change per branch or per product.
            </p>
          </div>
          {confirmed && (locked ? <Tone tone="gray">Locked</Tone> : <Tone tone="green">Confirmed</Tone>)}
          {!confirmed && <Tone tone="amber">Not confirmed</Tone>}
        </div>

        {!confirmed && (
          <ErrorNote>
            No costing method has been confirmed yet. Receiving stock is blocked until the company owner confirms one
            here.
          </ErrorNote>
        )}

        {locked ? (
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-900">{currentMethod?.label}</p>
            <p className="mt-1 text-[11px] text-gray-600">{currentMethod?.text}</p>
            <p className="mt-2 text-[11px] text-gray-500">
              Locked{companyRow?.costing_locked_at ? ` since ${formatDate(companyRow.costing_locked_at)}` : ''} because stock
              has moved. Changing it now would mean revaluing every item already received, so it is not offered.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {METHODS.map((method) => {
                const selected = (pickedMethod || (confirmed ? effective.costing_method : '')) === method.value
                return (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer gap-3 rounded-md border p-3 ${selected ? 'border-core bg-core/5' : 'border-gray-200'} ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    <input
                      type="radio"
                      name="costing-method"
                      className="mt-0.5"
                      disabled={!canEdit}
                      checked={selected}
                      onChange={() => setPickedMethod(method.value)}
                    />
                    <span>
                      <span className="block text-xs font-medium text-gray-900">{method.label}</span>
                      <span className="mt-0.5 block text-[11px] text-gray-600">{method.text}</span>
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              This locks permanently the moment any branch posts its first stock movement, receipts included. After that
              it cannot be changed.
            </div>

            {!confirmed && (
              <label className="flex items-start gap-2 text-[11px] text-gray-700">
                <input type="checkbox" className="mt-0.5" checked={understood} disabled={!canEdit} onChange={(event) => setUnderstood(event.target.checked)} />
                I understand that this cannot be changed after stock moves.
              </label>
            )}

            {methodError && <ErrorNote>{methodError}</ErrorNote>}
            {methodSaved && <p className="text-[11px] text-emerald-700">Saved.</p>}

            {canEdit ? (
              <div className="flex justify-end">
                {confirmed ? (
                  <Button
                    type="button"
                    className="h-7 bg-core text-xs text-white hover:bg-core/80"
                    disabled={methodBusy || !pickedMethod || pickedMethod === effective.costing_method}
                    onClick={() => saveMethod(false)}
                  >
                    {methodBusy ? 'Saving...' : 'Change method'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-7 bg-core text-xs text-white hover:bg-core/80"
                    disabled={methodBusy || !pickedMethod || !understood}
                    onClick={() => saveMethod(true)}
                  >
                    {methodBusy ? 'Confirming...' : 'Confirm costing method'}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">You need inventory edit access to confirm or change the method.</p>
            )}
          </>
        )}
      </section>

      {/* 2. Rules */}
      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-800">Pricing and stock rules</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {override
                ? 'This branch uses its own values.'
                : 'This branch follows the company defaults. Changes you save here change the company default.'}
            </p>
          </div>
          {canEdit && !editing && (
            <Button type="button" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {editing && (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={cancelRules} disabled={rulesBusy}>
                Cancel
              </Button>
              <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={saveRules} disabled={rulesBusy}>
                {rulesBusy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md bg-gray-50 p-3">
          <div>
            <p className="text-xs font-medium text-gray-800">Override for this branch</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Off: this branch follows the company defaults. On: the values below apply only to this branch.
            </p>
          </div>
          <Switch checked={override} disabled={!editing} onCheckedChange={setOverride} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-700">Cost used for percentage mark-ups</p>
          {editing ? (
            <Select value={draft.pricing_cost_basis} onValueChange={(value) => setDraft((prev) => ({ ...prev, pricing_cost_basis: value }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICING_BASES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value} className="text-xs">{entry.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-gray-900">{basisLabel}</p>
          )}
          <p className="text-[11px] text-gray-500">The cost a selling price is worked out from when it is set as a percentage over cost.</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-700">When stock would go below zero</p>
          {editing ? (
            <Select value={draft.negative_stock_policy} onValueChange={(value) => setDraft((prev) => ({ ...prev, negative_stock_policy: value }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NEGATIVE_POLICIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value} className="text-xs">{entry.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-gray-900">{policy?.label}</p>
          )}
          <p className="text-[11px] text-gray-500">{policy?.text}</p>
        </div>

        {rulesError && <ErrorNote>{rulesError}</ErrorNote>}
      </section>
    </div>
  )
}
