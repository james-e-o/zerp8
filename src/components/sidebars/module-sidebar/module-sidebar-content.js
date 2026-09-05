"use client"

import { ArrowLeftRight, BadgeDollarSign, BarChart3, Boxes, Building2, Building, ClipboardCheck, ClipboardList, CreditCard, FileText, FilePlus, FileStack, FolderTree, Home, LayoutTemplate, List, ListFilter, Lock, PackageCheck, PackageSearch, Palette, Plus, Receipt, Settings2, ShoppingCart, SlidersHorizontal, Tags, Undo2, Truck, Warehouse, Users,
} from "lucide-react"
import { useParams, usePathname } from "next/navigation"
import { SidebarContent, SidebarGroup, SidebarMenu } from "@/components/ui/sidebar"
import { NoCollapsibleButton } from "./module-sidebar"

const ICONS = { BarChart3, ArrowLeftRight, Boxes, BadgeDollarSign, Building2, Building, ClipboardCheck, ClipboardList, CreditCard, FileText, FilePlus, FileStack, FolderTree, Home, LayoutTemplate, List, ListFilter, Lock, PackageCheck, PackageSearch, Palette, Plus, Receipt, Settings2, ShoppingCart, SlidersHorizontal, Tags, Truck, Undo2, Users, Warehouse,}

export default function ModuleSidebarContent({ title, items = [], basePath = "", company, branch }) {
  const params = useParams()
  const pathname = usePathname()

  const isActive = (href, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const branchDashboardPath = `/users/${params.u}/company/${params.companyId}/branches/${params.branchId}`

  return (
    <SidebarContent className="bg-armylight text-sm text-zinc-100">
      <SidebarGroup>
        <SidebarMenu>
          <NoCollapsibleButton
            url={branchDashboardPath}
            title="Dashboard"
            icon={Building}
            iconClass="text-core"
            active={pathname === branchDashboardPath}
            name={`${branch?.name || "Branch"} Dashboard`}
          />

          {title && (
            <div className=" my-3 mx-2 px-4 py-1.5  flex justify-center items-center rounded-sm bg-core_light w-fit">
              <span className="text-xs font-semibold text-core tracking-wide">{title.toUpperCase()}</span>
            </div>
          )}

          {(items || []).map((item) => {
            const href = item.path === "" ? basePath : item.path === "/" ? basePath : `${basePath}${item.path}`.replace(/\/+/g, "/")
            const Icon = typeof item.icon === "string" ? ICONS[item.icon] || List : item.icon

            return (
              <NoCollapsibleButton
                key={item.label}
                url={href}
                title={item.label}
                icon={Icon}
                active={isActive(href, item.path === "")}
                name={item.label}
              />
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  )
}
