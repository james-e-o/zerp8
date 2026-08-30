"use client"

import { useContext } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BranchSidebar } from "@/components/sidebars/branch-sidebar/branch-sidebar"
import BranchHeader from "@/components/headers/branch-header"
import { CompanyInfoContext } from "../../companyInfoProvider"
import { BranchContext } from "./branchContext"

export default function BranchLayoutClient({ children, currentBranch, modules, company }) {
  const parentContext = useContext(CompanyInfoContext)
  const companyInfo = company || parentContext?.info

  return (
    <BranchContext.Provider value={{ currentBranch, modules }}>
      <CompanyInfoContext.Provider value={parentContext}>
        {children}
      </CompanyInfoContext.Provider>
    </BranchContext.Provider>
  )
}

export const ReusableBranchSidebar = ({ children }) => {
  const { currentBranch, modules } = useContext(BranchContext)
  const { info } = useContext(CompanyInfoContext)

  return (
    <SidebarProvider className="relative">
      <BranchSidebar company={info} modules={modules} />

      <SidebarInset className="h-svh overflow-hidden static">
        <div className="flex flex-col h-full">
          <div className="h-12 border-b border-border">
            <BranchHeader>
              <div className="flex">
                <Button variant="ghost" size="icon" className="relative ml-3">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-rose-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full">
                    3
                  </span>
                </Button>
              </div>
            </BranchHeader>
          </div>

          <div className="grow overflow-y-auto p-2 bg-background">
            {currentBranch ? children : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}