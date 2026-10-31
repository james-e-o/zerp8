'use client'

import { useParams } from 'next/navigation'

// Shared by the Transfers pages and the warehouse Transfers tab. Needs
// inventory-shared.jsx, receipt-shared.jsx and adjustment-shared.jsx (for
// formatDateTime) from the earlier sets.

export function useTransferPaths() {
  const { u, companyId, branchId } = useParams()
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`
  return { u, companyId, branchId, root, transfers: `${root}/transfers` }
}

// display_status comes from list_inventory_transfers.
//   pending    submitted, waiting for approval (nothing has moved)
//   approved   approved, waiting for the requester to send it
//   in_transit sent: the stock has left the sending warehouse and is in no
//              warehouse until the receiving warehouse accepts it
export const STATUS = {
  draft: { label: 'Draft', tone: 'gray' },
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved, ready to send', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  in_transit: { label: 'In transit', tone: 'blue' },
  received: { label: 'Received', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

export const DIRECTION = {
  out: { label: 'To another branch', tone: 'gray' },
  in: { label: 'From another branch', tone: 'blue' },
  internal: { label: 'Within this branch', tone: 'gray' },
}

// "1 NGN = 0.002 USD", or a plain note when both sides use one currency.
export function describeRate(fromCurrency, toCurrency, rate) {
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return ''
  if (!rate) return `No exchange rate on file between ${fromCurrency} and ${toCurrency}.`
  return `1 ${fromCurrency} = ${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toCurrency}`
}
