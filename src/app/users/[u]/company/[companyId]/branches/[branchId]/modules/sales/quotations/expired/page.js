'use client'

import { useParams } from 'next/navigation'
import QuotationsFilteredList from '@/components/modules/sales/quotations-filtered-list'
import { DUMMY_QUOTATIONS } from '@/components/modules/sales/dummy-data'

export default function ExpiredQuotationsPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const now = new Date()
  const quotations = DUMMY_QUOTATIONS.filter((quotation) => quotation.status === 'sent' && new Date(quotation.validUntil) < now)

  return <QuotationsFilteredList title="Expired" base={base} quotations={quotations} emptyMessage="No expired quotations." />
}
