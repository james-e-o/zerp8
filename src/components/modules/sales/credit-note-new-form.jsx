'use client'

import { useState } from 'react'

import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

import {
  DUMMY_INVOICES,
  formatNaira,
} from '@/components/modules/sales/dummy-data'

export default function CreditNoteNewForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()

  const [invoiceId, setInvoiceId] = useState(
    searchParams.get('invoiceId') || DUMMY_INVOICES[0]?.id || ''
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const invoice = DUMMY_INVOICES.find((item) => item.id === invoiceId)

  const invoicesPath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`

  const handleSubmit = async (event) => {
    event.preventDefault()

    setSaving(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    setSaving(false)
    router.push(invoicesPath)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            New Credit Note
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="credit-note-form"
            className="bg-core text-white"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Issue Credit Note'}
          </Button>
        </div>
      </div>

      <form
        id="credit-note-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 grow flex-col gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Sales Invoice

            <select
              value={invoiceId}
              onChange={(event) => setInvoiceId(event.target.value)}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none"
            >
              {DUMMY_INVOICES.filter(
                (item) => item.type === 'sales_invoice'
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} - {item.customerName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-gray-800">
            Reason

            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for credit note"
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none"
              required
            />
          </label>
        </div>

        <div className="min-h-0 grow overflow-auto rounded-lg border border-gray-200 bg-white p-4">
          {invoice && (
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="py-2">Product</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2">{item.name}</td>
                    <td className="py-2">{item.qty}</td>
                    <td className="py-2 text-right">
                      {formatNaira(item.qty * (item.unitPrice || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </form>
    </div>
  )
}

