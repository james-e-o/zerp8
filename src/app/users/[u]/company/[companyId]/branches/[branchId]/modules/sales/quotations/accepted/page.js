'use client'

import { useParams } from 'next/navigation'
import QuotationsFilteredList from '@/components/modules/sales/quotations-filtered-list'
import { DUMMY_QUOTATIONS } from '@/components/modules/sales/dummy-data'

export default function AcceptedQuotationsPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const quotations = DUMMY_QUOTATIONS.filter((quotation) => quotation.status === 'accepted')

  return <QuotationsFilteredList title="Accepted" base={base} quotations={quotations} emptyMessage="No accepted quotations yet." />
}
