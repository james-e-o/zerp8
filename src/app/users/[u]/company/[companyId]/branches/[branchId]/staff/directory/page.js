'use client'

import { useContext, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import supabase from '@/config/supabaseClient'
import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider'
import { StaffTable } from '@/components/staff-table'
import { Spinner } from '@/components/ui/spinner'

export default function BranchStaffDirectoryPage() {
  const { info } = useContext(CompanyInfoContext)
  const { u, companyId, branchId } = useParams()
  const [staffData, setStaffData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBranchDirectory = async () => {
      if (!companyId || !branchId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('staff')
          .select('*, staff_info(date_hired)')
          .eq('company', companyId)
          .eq('branch', branchId)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        setStaffData(
          (data || []).map((staff) => ({
            ...staff,
            date_hired: staff.staff_info?.[0]?.date_hired || null,
          }))
        )
      } catch (err) {
        console.error('Error fetching branch directory:', err)
        setError(err?.message || 'Failed to load branch staff directory')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBranchDirectory()
  }, [companyId, branchId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="size-8 text-core" spinning={true} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <StaffTable
        staffList={staffData}
        userId={u}
        companyId={companyId}
      />
    </div>
  )
}
