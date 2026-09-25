'use client'

import { useParams } from 'next/navigation'
import QuotationsFilteredList from '@/components/modules/sales/quotations-filtered-list'
import { DUMMY_QUOTATIONS } from '@/components/modules/sales/dummy-data'

export default function RejectedQuotationsPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const quotations = DUMMY_QUOTATIONS.filter((quotation) => quotation.status === 'rejected')

  return <QuotationsFilteredList title="Rejected" base={base} quotations={quotations} emptyMessage="No rejected quotations yet." />
}
