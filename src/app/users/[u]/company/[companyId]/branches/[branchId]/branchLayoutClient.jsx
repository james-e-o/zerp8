"use client"

import { useContext } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BranchSidebar } from "@/components/sidebars/branch-sidebar/branch-sidebar"
import BranchHeader from "@/components/headers/branch-header"
import { CompanyInfoContext } from "../../companyInfoProvider"
import { BranchContext } from "./branchContext"
import { BranchAssistantOverlay, BranchAssistantProvider, useBranchAssistant } from "@/components/ai/branch-assistant-context"

export default function BranchLayoutClient({ children, currentBranch, modules, company }) {
  const parentContext = useContext(CompanyInfoContext)
  const companyInfo = company || parentContext?.info

  return (
    <BranchAssistantProvider branchName={currentBranch?.name}>
      <BranchContext.Provider value={{ currentBranch, modules }}>
        <CompanyInfoContext.Provider value={parentContext}>
          {children}
        </CompanyInfoContext.Provider>
      </BranchContext.Provider>
    </BranchAssistantProvider>
  )
}

export const ReusableBranchSidebar = ({ children }) => {
  const { currentBranch, modules } = useContext(BranchContext)
  const { info } = useContext(CompanyInfoContext)
  const assistant = useBranchAssistant()

  return (
    <SidebarProvider className="relative">
        <BranchSidebar company={info} modules={modules} onAssistantClick={assistant?.onToggle} />

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

            <div className={`relative min-h-0 grow bg-background ${assistant?.isOpen ? "overflow-hidden" : "overflow-y-auto p-2"}`}>
              <div className="min-h-full">
                {currentBranch ? children : null}
              </div>
              <BranchAssistantOverlay />
            </div>
          </div>
        </SidebarInset>
    </SidebarProvider>
  )
}