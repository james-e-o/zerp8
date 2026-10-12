'use client'

import { useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

// Suppliers are branch-owned (confirmed against the real `suppliers`
// table, which carries both `company` and `branch` columns) - each
// supplier belongs to one specific branch and is only usable/visible
// within that branch, not shared company-wide. Lists and the detail
// page filter by branch accordingly.
//
// Real columns on `suppliers`: id, company, branch, name, email,
// phone, address, payment_terms, status, created_by, created_at,
// updated_at - confirmed via information_schema.columns. No
// credit_limit, no outstanding_balance - neither exists on this
// table, so neither is referenced anywhere in this file.
function SupplierStatusBadge({ status }) {
  const isActive = status !== 'inactive'
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium ${
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

// `base` isn't needed here anymore for a title/New-supplier action -
// the route's layout (SuppliersLayout) already renders the page title
// and the New supplier button via PageHeader, so this component only
// owns the list itself. `base` is still accepted for the row
// navigation below.
export default function SuppliersList({ base }) {
  const { companyId, branchId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext) || {}

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, email, phone, payment_terms, status')
        .eq('company', companyId)
        .eq('branch', branchId)
        .order('name', { ascending: true })

      if (cancelled) return

      if (error) {
        console.error('Failed to load suppliers:', error)
        setErrorMessage('Failed to load suppliers.')
      } else {
        setSuppliers(data || [])
      }
      setLoading(false)
    }

    if (companyId && branchId) load()
    return () => {
      cancelled = true
    }
  }, [companyId, branchId])

  const visibleSuppliers = showInactive
    ? suppliers
    : suppliers.filter((supplier) => supplier.status !== 'inactive')

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="size-3.5 rounded-sm border-border"
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading suppliers...</p>
      ) : errorMessage ? (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
      ) : visibleSuppliers.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {suppliers.length === 0 ? 'No suppliers yet.' : 'No active suppliers. Turn on "Show inactive" to see the rest.'}
        </div>
      ) : (
        <div className="overflow-hidden border border-border rounded-sm bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Phone</th>
                <th className="px-4 py-2 text-left font-medium">Payment terms</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleSuppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${supplier.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`${base}/${supplier.id}`)
                    }
                  }}
                  className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core"
                >
                  <td className="px-4 py-2 font-medium text-foreground">{supplier.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{supplier.email || '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{supplier.phone || '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{supplier.payment_terms || '—'}</td>
                  <td className="px-4 py-2"><SupplierStatusBadge status={supplier.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export { SupplierStatusBadge }