"use client"

import { ArrowLeftRight, BarChart3, Boxes, Building2, Building, ClipboardCheck, ClipboardList, FileText, FilePlus, FileStack, Home, LayoutTemplate, List, Lock, PackageCheck, Palette, Plus, Receipt, Settings2, ShoppingCart, SlidersHorizontal, Undo2, Truck, Warehouse, Users,
} from "lucide-react"
import { useParams } from "next/navigation"
import { SidebarContent, SidebarGroup, SidebarMenu } from "@/components/ui/sidebar"
import { NoCollapsibleButton } from "./module-sidebar"

const ICONS = {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  Building,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FilePlus,
  FileStack,
  Home,
  LayoutTemplate,
  List,
  Lock,
  PackageCheck,
  Palette,
  Plus,
  Receipt,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Undo2,
  Users,
  Warehouse,
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
