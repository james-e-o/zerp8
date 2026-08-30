// src/app/users/[u]/company/[companyId]/staff/directory/[id]/page.js
'use client'

import { useContext, useState, useEffect } from 'react'
import { CompanyInfoContext } from '../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useParams } from 'next/navigation'

export default function StaffOverview() {
  const { info } = useContext(CompanyInfoContext)
  const { id, companyId } = useParams()
  const [staffData, setStaffData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [branchName, setBranchName] = useState(null)
  const [isBranchLoading, setIsBranchLoading] = useState(false)
  const [roleName, setRoleName] = useState(null)
  const [isRoleLoading, setIsRoleLoading] = useState(false)

  useEffect(() => {
    const fetchStaffData = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*, staff_info!staff_info_staff_id_fkey(*)')
          .eq('id', id)
          .eq('company', companyId)
          .single()

        if (error) throw error

        const staffInfo = Array.isArray(data.staff_info) ? data.staff_info[0] : data.staff_info

        setStaffData({
          ...data,
          ...staffInfo,
          date_hired: data.staff_info?.[0]?.date_hired || null,
        })
      } catch (err) {
        console.error('Error fetching staff:', err)
        setStaffData(null)
      } finally {
        setIsLoading(false)
      }
    }

    if (companyId && id) {
      fetchStaffData()
    }
  }, [companyId, id])

  // Fetch branch name from branches table.
  // Moved above the early returns below so hook order stays stable across
  // renders — guard on staffData?.branch instead of bailing out via return.
  useEffect(() => {
    const fetchBranchName = async () => {
      if (!staffData?.branch) return

      setIsBranchLoading(true)
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('name')
          .eq('id', staffData.branch)
          .single()

        if (error) {
          console.error('Error fetching branch:', error)
        } else {
          setBranchName(data?.name)
        }
      } catch (err) {
        console.error('Error fetching branch:', err)
      } finally {
        setIsBranchLoading(false)
      }
    }

    fetchBranchName()
  }, [staffData?.branch])

  // Fetch role name from company_roles table.
  // Same fix — moved above the early returns, guarded internally.
  useEffect(() => {
    const fetchRoleName = async () => {
      if (!staffData?.role) {
        setIsRoleLoading(false)
        return
      }

      setIsRoleLoading(true)
      try {
        const { data, error } = await supabase
          .from('company_roles')
          .select('role')
          .eq('id', staffData.role)
          .single()

        if (error) {
          console.error('Error fetching role:', error)
        } else {
          setRoleName(data?.role)
        }
      } catch (err) {
        console.error('Error fetching role:', err)
      } finally {
        setIsRoleLoading(false)
      }
    }

    fetchRoleName()
  }, [staffData?.role])

  if (isLoading) {
    return <p className="text-gray-600">Loading staff member...</p>
  }

  if (!staffData) {
    return <p className="text-gray-600">Staff member not found</p>
  }

  const InfoField = ({ label, value }) => (
    <div className="space-y-1">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-gray-900 font-medium">{value || 'N/A'}</p>
    </div>
  )

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      suspended: 'bg-orange-100 text-orange-700 border-orange-200',
      terminated: 'bg-gray-100 text-gray-700 border-gray-200',
    }
    return colors[status?.toLowerCase()] || colors.active
  }

  return (
    <div className="space-y-6">
      {/* Top Section - Profile Card + Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Profile Card */}
        <Card className="border-gray-200 shadow-sm p-6 lg:col-span-1">
          <div className="text-center space-y-4">
            <Avatar className="w-32 h-32 mx-auto">
              {staffData.photo ? (
                <AvatarImage src={staffData.photo} alt={staffData.name} />
              ) : (
                <AvatarFallback className="text-3xl bg-linear-to-br from-core to-army text-white">
                  {getInitials(staffData.name)}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{staffData.name}</h2>
            </div>
          </div>
        </Card>

        {/* Right - Quick Info Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Employment Status */}
          <Card className="border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-gray-500 font-medium">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(staffData.status)}`}>
                  {staffData.status}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500 font-medium">Access Level</p>
                <p className=" font-medium text-core uppercase">{staffData.access_level }</p>
              </div>
            </div>
          </Card>

          {/* Employment Details */}
          <Card className="border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-gray-500 font-medium">Branch</p>
                {isBranchLoading ? (
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-gray-900 font-medium">{branchName || 'N/A'}</p>
                )}
              </div>
              <InfoField
                label="Date Hired"
                value={
                  staffData.date_hired
                    ? new Date(staffData.date_hired).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Personal Information Section */}
      <Card className="border-gray-200 mb-6 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoField label="First Name" value={staffData.first_name} />
          <InfoField label="Last Name" value={staffData.last_name} />
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium">Role</p>
            {isRoleLoading ? (
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <p className="text-gray-900 font-medium">{roleName || 'No role assigned'}</p>
            )}
          </div>
          <InfoField label="Email" value={staffData.email} />
          <InfoField label="Phone" value={staffData.phone} />
          <InfoField label="Gender" value={staffData.gender} />
          <InfoField label="Identity Type" value={staffData.identity_type} />
          <InfoField label="Identity Number" value={staffData.identity_number} />
          <InfoField label="Bank Account" value={staffData.bank_account} />
          <div className="md:col-span-2">
            <InfoField label="Address" value={staffData.address} />
          </div>
          <InfoField
            label="Date Added"
            value={
              staffData.created_at
                ? new Date(staffData.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'
            }
          />
          <InfoField
            label="Last Updated"
            value={
              staffData.updated_at
                ? new Date(staffData.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'
            }
          />
        </div>
      </Card>
    </div>
  )
}