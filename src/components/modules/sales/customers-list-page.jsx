'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Input } from '@/components/ui/input'
import { useMoney } from '@/components/modules/sales/quotation-shared'

// One list for every Customers tab (All, Active, Inactive).
const EMPTY_TEXT = {
  all: 'No customers yet.',
  active: 'No active customers.',
  inactive: 'No inactive customers.',
}

export default function CustomersListPage({ status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/customers`

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrorMessage('')
      let query = supabase
        .from('customers')
        .select('id, customer_number, customer_type, name, contact_person, email, phone, payment_terms, credit_limit, status')
        .eq('branch', branchId)
        .order('name')
      if (status === 'active' || status === 'inactive') query = query.eq('status', status)
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('Failed to load customers:', error)
        setErrorMessage(error.message || 'Could not load customers.')
        toast.error(error.message || 'Could not load customers.')
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, status])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      `${row.name} ${row.customer_number} ${row.contact_person || ''} ${row.phone || ''} ${row.email || ''}`.toLowerCase().includes(term)
    )
  }, [rows, search])

  return (
    <div className="flex flex-col gap-3 px-1 py-3 text-xs">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, ID, phone or email..."
        className="h-8 max-w-xs text-xs"
      />

      {loading ? (
        <p className="text-muted-foreground">Loading customers...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {search ? 'No customer matches your search.' : EMPTY_TEXT[status] || EMPTY_TEXT.all}
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Contact</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Payment terms</th>
                <th className="px-4 py-2 text-right font-medium">Credit limit</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`${base}/${row.id}`} className="font-medium text-foreground hover:text-core">{row.name}</Link>
                    <p className="text-[10px] text-muted-foreground">{row.customer_number}</p>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.contact_person && <p>{row.contact_person}</p>}
                    <p>{[row.phone, row.email].filter(Boolean).join(' · ') || '—'}</p>
                  </td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{row.customer_type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.payment_terms}</td>
                  <td className="px-4 py-2 text-right">{row.credit_limit == null ? '—' : money(row.credit_limit)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {row.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
