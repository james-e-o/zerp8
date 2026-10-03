'use client'

import { useParams, usePathname } from 'next/navigation'

const SETTINGS = {
  all: [['Branch name', 'Shown on purchase orders, receipts, and bills.', 'NexShelf - Lekki Branch'], ['Default currency', 'Applied across purchasing documents.', 'Nigerian Naira (Naira)']],
  numbering: [['Purchase Order prefix', 'e.g. PO-0045', 'PO-'], ['Receipt prefix', 'e.g. GRN-0124', 'GRN-'], ['Bill prefix', 'e.g. BILL-0125', 'BILL-'], ['Return prefix', 'e.g. PR-0030', 'PR-']],
  taxes: [['VAT rate', 'Applied to purchase orders and bills.', '7.5%']],
  terms: [['Default payment terms', 'Used when a supplier payment term is not set individually.', 'Net 30']],
}

export default function PurchasesSettingsPage() {
  const pathname = usePathname()
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/settings`
  const section = pathname === base ? 'all' : pathname.slice(base.length + 1).split('/')[0]
  const fields = SETTINGS[section] || SETTINGS.all

  return <div className="rounded-lg border border-line bg-surface p-6">{fields.map(([label, hint, value]) => <div key={label} className="grid grid-cols-1 gap-3 border-b border-line py-4 last:border-0 sm:grid-cols-3 sm:gap-6"><div><p className="text-sm font-medium text-ink">{label}</p><p className="mt-0.5 text-xs text-inkmute">{hint}</p></div><div className="sm:col-span-2"><input defaultValue={value} className="w-full max-w-sm rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" /></div></div>)}</div>
}
