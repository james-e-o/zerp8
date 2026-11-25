"use client"

import { Bell, Eye } from "lucide-react"
import { ParamsProvider } from "@/components/params-provider"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import ModuleSidebar from "@/components/sidebars/module-sidebar/module-sidebar"
import ModuleHeader from "@/components/headers/module-header"
import { BranchAssistantOverlay } from "@/components/ai/branch-assistant-context"

// Shown when the subscription no longer includes Inventory but the company
// still has its records. Explanation only.
function ReadOnlyBanner() {
  return (
    <div
      role="status"
      className="mb-2 shrink-0 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>View only. Your subscription no longer includes Inventory.</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed opacity-90">
        You can read existing records but cannot make changes, such as receiving, adjusting or transferring stock.
      </p>
    </div>
  )
}

export default function InventoryLayoutClient({ params, title, items, basePath, accessLevel, profile, company, branch, children }) {
  const readOnly = accessLevel === "read_only"

  return (
    <ParamsProvider params={params}>
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

            <div className="relative min-h-0 grow overflow-hidden bg-background">
              {readOnly ? (
                <div className="h-full flex flex-col overflow-hidden py-2 md:px-4 px-2">
                  <ReadOnlyBanner />
                  <div className="min-h-0 grow overflow-y-auto">{children}</div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto py-2 md:px-4 px-2">{children}</div>
              )}
              <BranchAssistantOverlay />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ParamsProvider>
  )
}