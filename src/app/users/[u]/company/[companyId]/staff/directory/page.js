'use client'

import { useContext } from 'react'
import { CompanyInfoContext } from '../../companyInfoProvider'
import { StaffContext } from '@/components/contexts/staff-context'
import { StaffTable } from '@/components/staff-table'
import { Spinner } from '@/components/ui/spinner'
import { useParams } from 'next/navigation'

export default function StaffDirectory() {
  const { info, user } = useContext(CompanyInfoContext)
  const { staffData, isLoadingStaff } = useContext(StaffContext)
  const { u, companyId } = useParams()


  if (isLoadingStaff) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="size-8 text-core" spinning={true} />
      </div>
    )
  }

  return (
    <StaffTable 
      staffList={staffData}
      userId={u}
      companySlug={info?.slug}
      companyId={companyId}
    />
  )
}
