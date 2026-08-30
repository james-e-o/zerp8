'use client'

import { useEffect, useMemo, useState, useContext } from 'react'
import { useParams } from 'next/navigation'
import supabase from '@/config/supabaseClient'
import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { Spinner } from '@/components/ui/spinner'
import { useAccess } from '@/hooks/use-access'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  UserPlus,
  CircleDot,
} from 'lucide-react'

function KpiStrip({ items }) {
  return (
    <div className="bg-card border border-border rounded-xl mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-border">
      {items.map((item, i) => (
        <div key={i} className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1.5">
            <item.icon className={`size-3.5 ${item.color}`} />
            <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
          </div>
          <span className="text-2xl font-mono font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function DistributionItem({ label, count, percentage }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          {count} · {percentage}%
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-core rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function BranchStaffPhotoGrid({ staffData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {staffData.length === 0 ? (
        <p className="col-span-full text-sm text-muted-foreground text-center py-12">
          No staff members in this branch yet
        </p>
      ) : (
        staffData.map((staff) => {
          const displayName = staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unnamed'
          const initials = displayName.slice(0, 2).toUpperCase()

          return (
            <div
              key={staff.id}
              className="bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center gap-2"
            >
              {staff.photo ? (
                <img
                  src={staff.photo}
                  alt={displayName}
                  className="size-16 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="size-16 rounded-full bg-core_light flex items-center justify-center">
                  <span className="text-core font-semibold text-lg">{initials}</span>
                </div>
              )}
              <div className="min-w-0 w-full">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                {staff.access_level && (
                  <p className="text-xs text-muted-foreground truncate capitalize">{staff.access_level}</p>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function BranchStaffPage() {
  const { info } = useContext(CompanyInfoContext)
  const { currentBranch } = useContext(BranchContext) || {}
  const access = useAccess()
  const { u, companyId, branchId } = useParams()
  const [staffData, setStaffData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBranchStaff = async () => {
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
        console.error('Error fetching branch staff:', err)
        setError(err?.message || 'Failed to load branch staff')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBranchStaff()
  }, [companyId, branchId])

  const canManageStaffInfo = access.isOwner || access.hasAnyPermission([
    { scopeKey: 'staff_info', permissionKey: 'edit' },
    { scopeKey: 'staff_info', permissionKey: 'create' },
    { scopeKey: 'staff_info', permissionKey: 'manage' },
  ])

  const stats = useMemo(() => {
    if (!staffData || staffData.length === 0) {
      return {
        totalStaff: 0,
        activeStaff: 0,
        suspendedStaff: 0,
        pendingInvites: 0,
        newThisMonth: 0,
        byAccessLevel: {},
        byBranch: {},
        recentActivity: [],
      }
    }

    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const calculated = {
      totalStaff: staffData.length,
      activeStaff: staffData.filter((s) => s.status === 'active').length,
      suspendedStaff: staffData.filter((s) => s.status === 'suspended').length,
      pendingInvites: staffData.filter((s) => s.status === 'pending').length,
      newThisMonth: staffData.filter((s) => {
        if (!s.date_hired) return false
        return new Date(s.date_hired) >= oneMonthAgo
      }).length,
      byAccessLevel: {},
      byBranch: {},
    }

    staffData.forEach((staff) => {
      const level = staff.access_level || 'Unassigned'
      calculated.byAccessLevel[level] = (calculated.byAccessLevel[level] || 0) + 1

      const branchLabel = staff.branch || 'This Branch'
      calculated.byBranch[branchLabel] = (calculated.byBranch[branchLabel] || 0) + 1
    })

    calculated.recentActivity = [
      ...staffData
        .filter((s) => s.status !== 'terminated' && s.status !== 'suspended')
        .slice(0, 4)
        .map((s) => ({ staff: s, kind: 'joined' })),
      ...staffData
        .filter((s) => s.status === 'suspended')
        .slice(0, 4)
        .map((s) => ({ staff: s, kind: 'suspended' })),
    ]

    return calculated
  }, [staffData])

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
    <div className="space-y-6 grow flex flex-col overflow-y-auto">
      {!canManageStaffInfo ? (
        <BranchStaffPhotoGrid staffData={staffData} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {currentBranch?.name || 'Branch'} staff overview
              </h1>
              <p className="text-sm text-muted-foreground">
                {info?.name || 'Company'} • {stats.totalStaff} staff member{stats.totalStaff === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <KpiStrip
            items={[
              { icon: Users, label: 'Total', value: stats.totalStaff, color: 'text-core' },
              { icon: UserCheck, label: 'Active', value: stats.activeStaff, color: 'text-emerald-600' },
              { icon: UserX, label: 'Suspended', value: stats.suspendedStaff, color: 'text-rose-600' },
              { icon: Clock, label: 'Pending', value: stats.pendingInvites, color: 'text-amber-600' },
              { icon: UserPlus, label: 'New (30d)', value: stats.newThisMonth, color: 'text-core' },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">By access level</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byAccessLevel).length > 0 ? (
                    Object.entries(stats.byAccessLevel)
                      .sort(([, a], [, b]) => b - a)
                      .map(([level, count]) => (
                        <DistributionItem
                          key={level}
                          label={level}
                          count={count}
                          percentage={stats.totalStaff > 0 ? Math.round((count / stats.totalStaff) * 100) : 0}
                        />
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No staff yet</p>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">By branch</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byBranch).length > 0 ? (
                    Object.entries(stats.byBranch)
                      .sort(([, a], [, b]) => b - a)
                      .map(([branch, count]) => (
                        <DistributionItem
                          key={branch}
                          label={branch}
                          count={count}
                          percentage={stats.totalStaff > 0 ? Math.round((count / stats.totalStaff) * 100) : 0}
                        />
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No staff yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map(({ staff, kind }) => {
                    const displayName = staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unnamed'

                    return (
                      <div
                        key={staff.id}
                        className="flex items-center justify-between px-6 py-3.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CircleDot
                            className={`size-2.5 shrink-0 ${
                              kind === 'suspended'
                                ? 'fill-rose-500 text-rose-500'
                                : 'fill-emerald-500 text-emerald-500'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {kind === 'suspended' ? 'Suspended' : 'Added to branch'}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs text-muted-foreground capitalize">
                          {staff.access_level || 'Unassigned'}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="px-6 py-10 text-sm text-muted-foreground text-center">
                    No recent activity
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
