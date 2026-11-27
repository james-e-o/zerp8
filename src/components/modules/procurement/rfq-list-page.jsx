'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { formatCurrency } from '@/components/modules/procurement/dummy-data'
import RfqStatusBadge from '@/components/modules/procurement/rfq-status-badge'
import {
  callRfqRpc,
  formatRfqDate,
  getCreatorName,
  isRfqDueSoon,
} from '@/components/modules/procurement/rfq-utils'
import supabase from '@/config/supabaseClient'

export default function RfqListPage({ status = 'all' }) {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const [rfqs, setRfqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/rfqs`

  useEffect(() => {
    let cancelled = false

    async function loadRfqs() {
      setLoading(true)
      setErrorMessage('')
      try {
        await callRfqRpc('rfq_sweep', { p_branch: branchId })
        let query = supabase
          .from('rfq_list')
          .select('*')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
        if (status !== 'all') query = query.eq('status', status)
        const { data, error } = await query
        if (error) throw error
        if (!cancelled) setRfqs(data || [])
      } catch (error) {
        console.error('Failed to load RFQs:', error)
        if (!cancelled) {
          const message = error.message || 'Could not load RFQs.'
          setErrorMessage(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (branchId) loadRfqs()
    return () => {
      cancelled = true
    }
  }, [branchId, status])

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading RFQs...</p>
  if (errorMessage) return <p className="p-4 text-xs text-red-600">{errorMessage}</p>

  return (
    <div className="h-full overflow-auto rounded-sm border border-border bg-card">
      {rfqs.length === 0 ? (
        <p className="p-6 text-center text-xs text-muted-foreground">No RFQs found.</p>
      ) : (
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
            <tr>
              {['Name', 'RFQ #', 'Supplier', 'Reply by', 'Quoted total', 'Created', 'Status'].map((heading) => (
                <th key={heading} className="border-b border-border px-3 py-2.5">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rfqs.map((rfq) => {
              const href = rfq.status === 'draft' ? `${base}/${rfq.id}/edit` : `${base}/${rfq.id}`
              const supplierName = rfq.supplier_name || rfq.supplier?.name || '—'
              const rfqNumber = rfq.rfq_number || '—'
              return (
                <tr key={rfq.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <Link href={href} className="text-core hover:underline">
                      {rfq.name || rfqNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{rfqNumber}</td>
                  <td className="px-3 py-2 text-foreground">{supplierName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {rfq.status === 'lost' ? (
                      <span>Expired {formatRfqDate(rfq.reply_by)}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {formatRfqDate(rfq.reply_by)}
                        {rfq.status === 'open' && isRfqDueSoon(rfq.reply_by) && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">Due soon</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {rfq.quoted_total == null
                      ? ''
                      : formatCurrency(Number(rfq.quoted_total), rfq.currency || currentBranch?.base_currency || '')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span>{formatRfqDate(rfq.created_at)}</span>
                    <span className="mt-0.5 block text-[10px]">{getCreatorName(rfq)}</span>
                  </td>
                  <td className="px-3 py-2"><RfqStatusBadge status={rfq.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
