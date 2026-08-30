'use client'

import { useContext } from 'react'
import { usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider'
import { useAccess } from '@/hooks/use-access'
import { List, LayoutDashboard } from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
  { key: 'directory', label: 'Directory', icon: List, path: '/directory' },
]

export default function BranchStaffLayout({ children }) {
  const { info } = useContext(CompanyInfoContext)
  const access = useAccess()
  const pathname = usePathname()
  const { u, companyId, branchId } = useParams()

  const canViewStaffInfo = access.isOwner || access.hasPermission('staff_info', 'view')

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'overview') return true
    if (access.isLoading) return false
    return canViewStaffInfo
  })

  const isActive = (path) => {
    if (path === '') return pathname.endsWith('/staff')
    return pathname.includes(path)
  }

  return (
    <div className="space-y-4 px-4 h-full flex-col flex overflow-hidden">
      <div className="my-1">
        <h1 className="text-lg m-1 font-semibold text-foreground">Branch Staff</h1>
      </div>

      <div className="flex items-center gap-2 py-1">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.path)
          const href = `/users/${u}/company/${companyId}/branches/${branchId}/staff${tab.path}`

          return (
            <Link key={tab.key} href={href} className="shrink-0 relative">
              <button
                className={`flex shrink-0 min-w-max cursor-pointer items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-core_light text-core border-core/20'
                    : 'text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            </Link>
          )
        })}
      </div>

      <div className="grow overflow-y-auto">{children}</div>
    </div>
  )
}
