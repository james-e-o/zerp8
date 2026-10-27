'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import { Pill } from '@/components/modules/inventory/inventory-shared'

// Shared pieces for the Inventory > Receipts and Inventory > Outgoing pages.
// Needs inventory-shared.jsx from the 21 Oct Stock set (Pill, formatters).

export function useFlowPaths() {
  const { u, companyId, branchId } = useParams()
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`
  return {
    u,
    companyId,
    branchId,
    root,
    receipts: `${root}/receipts`,
    outgoing: `${root}/outgoing`,
    orders: `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`,
    purchaseReceipts: `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`,
    purchaseReturns: `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/returns`,
    bills: `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`,
  }
}

// Where a receipt came from. Receipts that predate the source field are all
// purchase-order receipts.
export const RECEIPT_SOURCES = [
  { value: 'purchase_order', label: 'Purchase order' },
  { value: 'gift', label: 'Gift or donation' },
  { value: 'opening_stock', label: 'Opening stock' },
  { value: 'other', label: 'Other' },
]

export function sourceLabel(receipt) {
  const value = receipt?.source || (receipt?.purchase_order ? 'purchase_order' : 'other')
  return RECEIPT_SOURCES.find((entry) => entry.value === value)?.label || 'Other'
}

const TONES = {
  gray: 'border-gray-200 bg-gray-50 text-gray-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
}

export function Tone({ tone = 'gray', children }) {
  return <Pill className={TONES[tone] || TONES.gray}>{children}</Pill>
}

// Goods that do not match the order. Purchases decides about these; inventory
// only counts and holds them.
export function isExtraKind(kind) {
  return kind === 'excess' || kind === 'wrong_item'
}

export const HOLD_KIND = {
  normal: { label: 'Matches order', tone: 'gray' },
  excess: { label: 'Excess', tone: 'amber' },
  wrong_item: { label: 'Unexpected item', tone: 'red' },
  stock_damage: { label: 'Found damaged', tone: 'amber' },
}

// Why goods are damaged. The reason decides who acts next: damage on arrival
// is the supplier's, so purchases may return it for credit; the others are our
// own loss, so inventory writes them off.
export const DAMAGE_REASONS = [
  { value: 'arrival', label: 'Damaged on arrival' },
  { value: 'storage', label: 'Damaged in storage' },
  { value: 'expired', label: 'Expired' },
  { value: 'other', label: 'Other' },
]

export function damageReasonLabel(value) {
  return DAMAGE_REASONS.find((entry) => entry.value === (value || 'arrival'))?.label || 'Damaged'
}

// A damaged pile that came in with a delivery is purchases' to decide about
// (return it, or say it will not be returned) until it is written off.
export function awaitsPurchasesDecision(hold) {
  return (
    hold.status === 'damaged' &&
    !!hold.purchase_receipt_line_item &&
    (hold.damage_reason || 'arrival') === 'arrival' &&
    hold.return_decision !== 'write_off'
  )
}

export const HOLD_STATUS = {
  awaiting_review: { label: 'Awaiting check', tone: 'blue' },
  damaged: { label: 'Damaged', tone: 'red' },
  accepted: { label: 'Accepted', tone: 'green' },
  returned: { label: 'Returned', tone: 'gray' },
  written_off: { label: 'Written off', tone: 'gray' },
}

// One word for where a receipt stands. `holds` are the receipt's quarantine
// piles that still need a decision.
export function receiptState(receipt, openHolds = []) {
  if (receipt.status === 'draft') return { label: 'Draft', tone: 'gray' }
  if (receipt.status === 'cancelled') return { label: 'Cancelled', tone: 'gray' }
  if (openHolds.some((hold) => isExtraKind(hold.kind))) return { label: 'Excess pending', tone: 'amber' }
  if (openHolds.some((hold) => hold.status === 'damaged')) return { label: 'Damaged held', tone: 'red' }
  if (openHolds.length > 0) return { label: 'In quarantine', tone: 'blue' }
  return { label: 'Done', tone: 'green' }
}

export function chunk(list, size = 80) {
  const out = []
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size))
  return out
}

// Batch number and expiry for a list of batch ids, as { [id]: row }.
export async function fetchBatches(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  const result = {}
  for (const part of chunk(unique)) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('id, batch_number, supplier_batch_reference, expiry_date')
      .in('id', part)
    if (error) {
      console.error('Could not read batches:', error)
      continue
    }
    for (const row of data || []) result[row.id] = row
  }
  return result
}

// Returns that still hold goods back. A pile promised to one of these cannot
// be accepted, written off or put in another return.
export const OPEN_RETURN_STATUSES = ['draft', 'pending_approval', 'approved']

// How much of each held pile is already in an open return, as { [holdId]: qty }.
export async function fetchReturnReserved(holdIds) {
  const unique = [...new Set((holdIds || []).filter(Boolean))]
  const reserved = {}
  for (const part of chunk(unique)) {
    const { data, error } = await supabase
      .from('purchase_return_line_items')
      .select('hold, quantity, purchase_returns!inner(status)')
      .in('hold', part)
      .in('purchase_returns.status', OPEN_RETURN_STATUSES)
    if (error) {
      console.error('Could not read open returns:', error)
      continue
    }
    for (const row of data || []) reserved[row.hold] = (reserved[row.hold] || 0) + Number(row.quantity || 0)
  }
  return reserved
}

// UI-only check; the database functions are the real enforcement.
export function useInventoryCan(verb) {
  const { branchId } = useParams()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!branchId) return
      const { data, error } = await supabase.rpc('can_access_inventory_resource', {
        p_branch: branchId,
        p_verb: verb,
      })
      if (!cancelled) setAllowed(!error && data === true)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [branchId, verb])

  return allowed
}

export function EmptyState({ children }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function ErrorNote({ children }) {
  return (
    <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
      {children}
    </p>
  )
}