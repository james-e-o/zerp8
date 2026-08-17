// components/user-sidebar-layout.jsx
'use client'

import { useContext } from 'react'
import { DataContext } from '@/app/users/[u]/pageLayoutProvider'
import { AppSidebar } from '@/components/sidebars/app-sidebar/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import Header from '@/components/headers/dashboard-header'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'

/**
 * Reusable sidebar layout wrapper for user dashboard routes.
 * All data (profile, companies) is fetched once, server-side, in
 * app/users/[u]/PageLayout.jsx and handed down through DataContext.
 * This component only reads and renders — it does not fetch.
 */
export default function UserSidebarLayout({ children }) {
  const { data } = useContext(DataContext)

  return (
    <SidebarProvider className="relative">
      <AppSidebar />
      <SidebarInset className="overflow-hidden h-svh static">
        <div className="flex h-full overflow-hidden flex-col">
          <div className="flex-col overflow-hidden h-full flex">
            <div className="h-12">
              <Header>
                <div className="flex">
                  <div className="md:flex gap-2 hidden mr-1 items-center"></div>
                  <Button variant="ghost" size="icon" className="relative ml-3">
                    <Bell className="h-5 w-5" />
                    {data?.pendingInvitesCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-red-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full">
                        {data.pendingInvitesCount > 99 ? '99+' : data.pendingInvitesCount}
                      </span>
                    )}
                  </Button>
                </div>
              </Header>
            </div>

            <div className="flex-col font-WixMade overflow-y-auto grow py-4 flex px-8">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}