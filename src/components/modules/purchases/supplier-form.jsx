'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DUMMY_SUPPLIERS } from './dummy-data'

export default function SupplierForm({ supplierId }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const existing = DUMMY_SUPPLIERS.find((supplier) => supplier.id === supplierId)
  const [form, setForm] = useState(existing || { name: '', email: '', phone: '', address: '', creditLimit: 0, paymentTerms: 'Net 30' })
  const [saving, setSaving] = useState(false)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers`
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const handleSubmit = async (event) => { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); router.push(supplierId ? `${base}/${supplierId}` : base) }

  return <div className="max-w-2xl"><form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"><label className="block text-sm font-semibold text-gray-800">Supplier name<input required value={form.name} onChange={(event) => update('name', event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-800">Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><label className="text-sm font-semibold text-gray-800">Phone<input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label></div><label className="block text-sm font-semibold text-gray-800">Address<textarea value={form.address} onChange={(event) => update('address', event.target.value)} rows={2} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-800">Credit limit (₦)<input type="number" min="0" value={form.creditLimit} onChange={(event) => update('creditLimit', Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm" /></label><label className="text-sm font-semibold text-gray-800">Payment terms<select value={form.paymentTerms} onChange={(event) => update('paymentTerms', event.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"><option>Due on receipt</option><option>Net 15</option><option>Net 30</option><option>Net 60</option></select></label></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button type="submit" className="bg-core text-white" disabled={saving}>{saving ? 'Saving...' : supplierId ? 'Save Supplier' : 'Create Supplier'}</Button></div></form></div>
}
