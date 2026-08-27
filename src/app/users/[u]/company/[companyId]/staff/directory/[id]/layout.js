'use client'

import { useContext, useState, useEffect } from 'react'
import { CompanyInfoContext } from '../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import StaffOverview from './page'
import EditStaffTab from './edit-staff/page'
import PermissionsTab from './permissions/page'
import { toast } from 'sonner'

export default function StaffDetailLayout() {
  const params = useParams()
  const router = useRouter()
  const { info } = useContext(CompanyInfoContext)
  const [staffData, setStaffData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchStaffData = async () => {
      setIsLoading(true)
      try {        
        const { data, error } = await supabase
          .from('staff')
          .select('*, staff_info(date_hired)')
          .eq('id', params.id)
          .eq('company', info.id)
          .single()

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        setStaffData({
          ...data,
          date_hired: data.staff_info?.[0]?.date_hired || null,
        })
      } catch (err) {
        console.error('Error fetching staff:', err)
        setStaffData(null)
      } finally {
        setIsLoading(false)
      }
    }

    if (info?.id && params?.id) {
      fetchStaffData()
    }
  }, [info?.id, params?.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8 text-core" spinning={true} />
      </div>
    )
  }

  if (!staffData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-gray-600">Staff member not found</p>
        <Link
          href={`/users/${params.u}/company/${params.companyId}/staff/directory`}
          className="text-core hover:underline text-sm"
        >
          Back to Directory
        </Link>
      </div>
    )
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green/10 text-green border-green/20',
      pending: 'bg-army/10 text-army border-army/20',
      suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
      terminated: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }
    return colors[status] || colors.active
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-[calc(100vh-200px)] flex flex-col">
        <div className='flex items-center justify-start gap-6'>

        <div className="flex items-center gap-4">
          <Link
            href={`/users/${params.u}/company/${params.companyId}/staff/directory`}
            className="flex items-center gap-2 text-army hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="size-5 text-core" />
            Back to Directory
          </Link>
        </div>
        <TabsList className="grid w-fit gap-5 grid-cols-3 bg-gray-100 p-1 shrink-0">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white data-[state=active]:text-core data-[state=active]:shadow-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="edit-staff"
            className="data-[state=active]:bg-white data-[state=active]:text-core data-[state=active]:shadow-sm"
          >
            Edit Staff
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="data-[state=active]:bg-white data-[state=active]:text-core data-[state=active]:shadow-sm"
          >
            Permissions
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 flex-1 overflow-y-auto">
          <StaffOverview staffData={staffData} setStaffData={setStaffData} />
        </TabsContent>

        <TabsContent value="edit-staff" className="space-y-4 flex-1 overflow-y-auto">
          <EditStaffTab staffData={staffData} setStaffData={setStaffData} onSaveSuccess={() => setActiveTab('overview')} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4 flex-1 overflow-y-auto">
          <PermissionsTab staffData={staffData} setStaffData={setStaffData} companyId={info.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
