"use client"

import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FilePlus,
  FileStack,
  Building,
  LayoutTemplate,
  List,
  Palette,
  Plus,
  Settings2,
} from "lucide-react"
import { useParams } from "next/navigation"
import { SidebarContent, SidebarGroup, SidebarMenu } from "@/components/ui/sidebar"
import { NoCollapsibleButton } from "./module-sidebar"

const ICONS = {
  Building2,
  List,
  Building,
  Plus,
  Palette,
  Settings2,
  BarChart3,
  Boxes,
  ClipboardList,
  FilePlus,
  FileStack,
  LayoutTemplate,
}

export default function ModuleSidebarContent({ title, items = [], basePath = "", company, branch }) {
  const params = useParams()

  return (
    <SidebarContent className="bg-armylight text-sm text-zinc-100">
      <SidebarGroup>
        <SidebarMenu>
          <NoCollapsibleButton
            url={`/users/${params.u}/company/${params.companyId}/branches/${params.branchId}`}
            title="Dashboard"
            icon={Building}
            iconClass="text-core"
            active={false}
            name={`${branch?.name || "Branch"} Dashboard`}
          />

          {(items || []).map((item) => {
            const href = item.href === "/" ? basePath : `${basePath}/${item.href}`.replace(/\/+/g, "/")
            const Icon = typeof item.icon === "string" ? ICONS[item.icon] || List : item.icon

            return (
              <NoCollapsibleButton
                key={item.label}
                url={href}
                title={item.label}
                icon={Icon}
                active={false}
                name={item.label}
              />
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  )
}
