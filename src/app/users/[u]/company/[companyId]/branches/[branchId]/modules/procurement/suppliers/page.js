'use client'

import { useParams } from 'next/navigation'
import SuppliersList from '@/components/modules/procurement/suppliers-list'

export default function SuppliersPage() {
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/suppliers`
  return <SuppliersList base={base} />
}
