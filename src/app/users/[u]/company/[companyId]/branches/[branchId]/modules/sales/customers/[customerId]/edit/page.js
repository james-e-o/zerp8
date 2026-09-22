"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DUMMY_CUSTOMERS } from "@/components/modules/sales/dummy-data"

export default function EditCustomerPage() {
  const router = useRouter()
  const { u, companyId, branchId, customerId } = useParams()
  const existing = DUMMY_CUSTOMERS.find((customer) => customer.id === customerId) || DUMMY_CUSTOMERS[0]
  const [form, setForm] = useState({ ...existing })
  const [saving, setSaving] = useState(false)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/customers`
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const handleSubmit = async (event) => { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); router.push(`${base}/${customerId}`) }

  return <div className="max-w-2xl space-y-6"><form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"><label className="block text-sm font-semibold text-gray-800">Customer name<input required value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-800">Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><label className="text-sm font-semibold text-gray-800">Phone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label></div><label className="block text-sm font-semibold text-gray-800">Address<textarea value={form.address} onChange={(event) => update("address", event.target.value)} rows={2} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-800">Credit limit (₦)<input type="number" min="0" value={form.creditLimit} onChange={(event) => update("creditLimit", Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><label className="text-sm font-semibold text-gray-800">Payment terms<select value={form.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"><option>Due on receipt</option><option>Net 15</option><option>Net 30</option><option>Net 60</option></select></label></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div></form></div>
}
