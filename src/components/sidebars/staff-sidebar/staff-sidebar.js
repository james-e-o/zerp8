"use client"

import { useContext } from "react"
import { LayoutDashboard, Settings } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import StaffSidebarContent from "./staff-sidebar-content"
import StaffSidebarFooter from "./staff-sidebar-footer"
import { StaffSidebarHeader } from "./staff-sidebar-header"

export function StaffSidebar({ ...props }) {
  const isMobile = useIsMobile()
  const params = useParams()

  return (
    <Sidebar className={'bg-white'} collapsible="icon" {...props}>
      <StaffSidebarHeader />
      <StaffSidebarContent />
      <StaffSidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}

