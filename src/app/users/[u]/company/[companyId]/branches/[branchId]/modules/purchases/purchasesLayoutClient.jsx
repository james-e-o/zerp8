"use client"

import { Bell } from "lucide-react"
import { useParams } from "next/navigation"
import { ParamsProvider } from "@/components/params-provider"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import ModuleSidebar from "@/components/sidebars/module-sidebar/module-sidebar"
import ModuleHeader from "@/components/headers/module-header"
import { PurchasesProvider } from "./purchases-context"

export default function PurchasesLayoutClient({ params, title, items, basePath, profile, company, branch, children }) {
  // branchId comes straight from the URL, same way PurchasesOverviewPage
  // already reads it - no new prop plumbing needed from the server layout.
  const { branchId } = useParams()

  return (
    <ParamsProvider params={params}>
      <PurchasesProvider branchId={branchId}>
        <SidebarProvider className="relative">
          <ModuleSidebar title={title} items={items} basePath={basePath} profile={profile} company={company} branch={branch} />

          <SidebarInset className="h-svh overflow-hidden static">
            <div className="flex flex-col h-full">
              <div className="h-12 border-b border-border">
                <ModuleHeader title={title}>
                  <div className="flex">
                    <Button variant="ghost" size="icon" className="relative ml-3">
                      <Bell className="h-5 w-5" />
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-rose-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full">
                        3
                      </span>
                    </Button>
                  </div>
                </ModuleHeader>
              </div>

              <div className="grow overflow-hidden py-2 md:px-4 px-2 bg-background">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </PurchasesProvider>
    </ParamsProvider>
  )
}