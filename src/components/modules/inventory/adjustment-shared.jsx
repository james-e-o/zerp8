'use client'

import { useParams } from 'next/navigation'

// Shared by the Adjustments pages. Needs receipt-shared.jsx and
// inventory-shared.jsx from the earlier Inventory sets.

export function useAdjustmentPaths() {
  const { u, companyId, branchId } = useParams()
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`
  return { u, companyId, branchId, root, adjustments: `${root}/adjustments`, outgoing: `${root}/outgoing`, writeOffs: `${root}/outgoing/write-offs` }
}

export const KIND = {
  count: { label: 'Stock count', tone: 'blue' },
  adjustment: { label: 'Adjustment', tone: 'gray' },
  outgoing: { label: 'Outgoing', tone: 'amber' },
}

// Outgoing: stock leaving other than by a sales delivery or a purchase return.
export const OUTGOING_TYPES = [
  { value: 'write_off', label: 'Write-off or sample', text: 'Stock that is damaged, expired, lost or stolen, or given out as a sample or kept on display.' },
  { value: 'gift', label: 'Gift', text: 'Stock given away free.' },
]

export function outgoingTypeLabel(value) {
  return OUTGOING_TYPES.find((entry) => entry.value === value)?.label || 'Outgoing'
}

export const OUTGOING_REASONS = {
  write_off: ['damaged', 'expired', 'lost', 'theft', 'sample', 'display', 'other'],
  gift: ['gift'],
}

// display_status comes from list_inventory_adjustments.
export const STATUS = {
  counting: { label: 'Counting', tone: 'blue' },
  pending: { label: 'Waiting for approval', tone: 'amber' },
  approved: { label: 'Approved, ready to post', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  posted: { label: 'Posted', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

export const REASONS = [
  { value: 'count_variance', label: 'Count difference' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'lost', label: 'Lost' },
  { value: 'theft', label: 'Theft' },
  { value: 'found', label: 'Found' },
  { value: 'correction', label: 'Correction' },
  { value: 'other', label: 'Other' },
  { value: 'sample', label: 'Sample' },
  { value: 'display', label: 'Display or demo' },
  { value: 'gift', label: 'Gift' },
]

export function reasonLabel(value) {
  return REASONS.find((entry) => entry.value === value)?.label || value
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// <input type="datetime-local"> wants local time without a zone.
export function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function signed(value) {
  const number = Number(value || 0)
  const text = Math.abs(number).toLocaleString(undefined, { maximumFractionDigits: 3 })
  return number > 0 ? `+${text}` : number < 0 ? `-${text}` : '0'
}
