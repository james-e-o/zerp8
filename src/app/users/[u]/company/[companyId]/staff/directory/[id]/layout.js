'use client'

import { useContext, useEffect, useState } from 'react'
import { CompanyInfoContext } from '../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, LayoutDashboard, Edit2, ShieldCheck } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
  { key: 'edit-staff', label: 'Edit Staff', icon: Edit2, path: '/edit-staff' },
  { key: 'permissions', label: 'Permissions', icon: ShieldCheck, path: '/permissions' },
]

export default function StaffDetailLayout({ children }) {
  const params = useParams()
  const pathname = usePathname()
  const { info } = useContext(CompanyInfoContext)
  const [staffData, setStaffData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStaffData = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*, staff_info!staff_info_staff_id_fkey(*)')
          .eq('id', params.id)
          .eq('company', info.id)
          .single()

        if (error) throw error

        const staffInfo = Array.isArray(data.staff_info) ? data.staff_info[0] : data.staff_info

        setStaffData({
          ...data,
          ...staffInfo,
          // `staff` has no `name` column — only first_name/last_name.
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unnamed staff',
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
        <p className="text-muted-foreground">Staff member not found</p>
        <Link
          href={`/users/${params.u}/company/${params.companyId}/staff/directory`}
          className="text-core hover:underline text-sm"
        >
          Back to Directory
        </Link>
      </div>
    )
  }

  const basePath = `/users/${params.u}/company/${params.companyId}/staff/directory/${params.id}`
  const navItems = NAV_ITEMS.map((item) => ({ ...item, href: `${basePath}${item.path}` }))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-start gap-4">
          <Link
            href={`/users/${params.u}/company/${params.companyId}/staff/directory`}
            className="flex items-center gap-1.5 text-sm text-core hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
            Back to Directory
          </Link>

          <nav className="flex flex-wrap items-center gap-2 py-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link key={item.href} href={item.href} className="shrink-0">
                  <button
                    className={`flex cursor-pointer items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-core_light text-core border-core/20'
                        : 'text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </button>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Sub-nav — same chip-pill pattern as the outer Staff layout's
            tab strip (padding, border, active/inactive states, icon size)
            so the two nav bars read as one consistent system. */}
        
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  )
}