'use client'

import { useContext, useMemo } from 'react'
import { CompanyInfoContext } from '../companyInfoProvider'
import { StaffContext } from '@/components/contexts/staff-context'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  ArrowRight,
  UserPlus,
  ListTree,
  CircleDot,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// KPI strip — hairline-divided, matches the company dashboard.
// ─────────────────────────────────────────────────────────────
function KpiStrip({ items }) {
  return (
    <div className="bg-card border border-border rounded-xl mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-border">
      {items.map((item, i) => (
        <div key={i} className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1.5">
            <item.icon className={`size-3.5 ${item.color}`} />
            <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
          </div>
          <span className="text-2xl font-mono font-semibold text-foreground">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Distribution bar — one row, label + count + bar.
// ─────────────────────────────────────────────────────────────
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

export default function StaffDashboard() {
  const { info } = useContext(CompanyInfoContext)
  const { staffData, isLoadingStaff } = useContext(StaffContext)
  const { u } = useParams()

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

      const branch = staff.branch || 'Main Branch'
      calculated.byBranch[branch] = (calculated.byBranch[branch] || 0) + 1
    })

    // One merged, timestamp-agnostic activity list — hires and suspensions
    // together, distinguished by a status dot, matching the dashboard's
    // ledger pattern instead of two separate cards.
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

  return (
    <div className="space-y-6 grow flex flex-col overflow-y-auto">
      {isLoadingStaff ? (
        <div className="flex items-center justify-center h-96">
          <Spinner className="size-8 text-core" spinning={true} />
        </div>
      ) : (
        <>
          <KpiStrip
            items={[
              { icon: Users, label: 'Total', value: stats.totalStaff, color: 'text-core' },
              { icon: UserCheck, label: 'Active', value: stats.activeStaff, color: 'text-emerald-600' },
              { icon: UserX, label: 'Suspended', value: stats.suspendedStaff, color: 'text-rose-600' },
              { icon: Clock, label: 'Pending', value: stats.pendingInvites, color: 'text-army' },
              { icon: UserPlus, label: 'New (30d)', value: stats.newThisMonth, color: 'text-core' },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Distribution — access level + branch, one card, two sections */}
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

            {/* Activity ledger — hires and suspensions merged, one list */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map(({ staff, kind }) => (
                    <Link
                      key={staff.id}
                      href={`/users/${u}/company/${info.slug}/staff/${staff.id}/`}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/60 transition-colors"
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
                          <p className="text-sm font-medium text-foreground truncate">
                            @{staff.users?.handle}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {staff.users?.email}
                            {kind === 'suspended' ? ' · suspended' : ''}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No recent activity</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions — flat tile, not a boxed CTA card */}
          <Link
            href={`/users/${u}/company/${info.slug}/staff/hierarchy`}
            className="bg-card border border-border rounded-xl px-6 py-4 flex items-center justify-between hover:border-core/40 hover:bg-core_light/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-muted group-hover:bg-card flex items-center justify-center">
                <ListTree className="size-4 text-muted-foreground group-hover:text-core transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Access levels</p>
                <p className="text-xs text-muted-foreground">View the full role hierarchy</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-core transition-colors" />
          </Link>
        </>
      )}
    </div>
  )
}