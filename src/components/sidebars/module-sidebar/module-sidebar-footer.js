"use client"

import { useParams } from "next/navigation"
import { SidebarFooter } from "@/components/ui/sidebar"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Settings, Sparkles } from "lucide-react"
import { NoCollapsibleButton } from "./module-sidebar"
import { BranchSidebarFooterUser } from "../branch-sidebar/branch-sidebar-footer-user"

export default function ModuleSidebarFooter({ profile, company, branch, onAssistantClick }) {
  const params = useParams()

  return (
    <SidebarFooter className="bg-armylight pb-8 flex-col flex gap-6">
      <div className="flex-col flex gap-1">
        <SidebarMenuItem className="w-fit mb-4">
          <SidebarMenuButton
            type="button"
            tooltip="Zerp-8 AI"
            onClick={onAssistantClick}
            className="w-fit max-w-full cursor-pointer whitespace-nowrap bg-blue-50 hover:bg-blue-100 hover:text-blue-500 text-blue-500"
          >
            <Sparkles className="" />
            <span className="ml-1 whitespace-nowrap font-Poppins text-sm font-medium">Zerp8 AI</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </div>

      <BranchSidebarFooterUser user={profile} u={params.u} companyId={params.companyId} branch={branch} />
    </SidebarFooter>
  )
}
