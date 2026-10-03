'use client'

import { useParams } from 'next/navigation'
import SuppliersList from '@/components/modules/purchases/suppliers-list'

export default function SuppliersPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers`
  return <SuppliersList base={base} />
}
