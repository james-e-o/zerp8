"use client"

import { Button } from "@/components/ui/button"

export default function BillingPage() {
  return (
    <div className="space-y-6 bg-white">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-600">Manage how your company pays and where billing documents are sent.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-gray-500">Payment method</h2>
          <p className="mb-4 text-sm text-gray-600">No payment method has been added yet.</p>
          <Button variant="outline" className="w-full">Add Payment Method</Button>
        </section>
        <section className="rounded-lg border border-gray-200 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-gray-500">Billing address</h2>
          <p className="mb-4 text-sm text-gray-600">Add a billing address for invoices and receipts.</p>
          <Button variant="outline" className="w-full">Add Billing Address</Button>
        </section>
      </div>
    </div>
  )
}
