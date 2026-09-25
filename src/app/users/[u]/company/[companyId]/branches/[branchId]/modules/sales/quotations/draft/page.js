'use client'

import { useParams } from 'next/navigation'
import QuotationsFilteredList from '@/components/modules/sales/quotations-filtered-list'
import { DUMMY_QUOTATIONS } from '@/components/modules/sales/dummy-data'

export default function DraftQuotationsPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const quotations = DUMMY_QUOTATIONS.filter((quotation) => quotation.status === 'draft')

  return <QuotationsFilteredList title="Draft" base={base} quotations={quotations} emptyMessage="No draft quotations yet." />
}
