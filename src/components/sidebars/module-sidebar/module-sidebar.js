"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  Sidebar,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AppSidebarHeader } from "@/components/sidebars/app-sidebar/app-sidebar-header"
import ModuleSidebarContent from "./module-sidebar-content"
import ModuleSidebarFooter from "./module-sidebar-footer"

export default function ModuleSidebar({ title, items = [], basePath = "", profile, company, branch }) {
  return (
    <Sidebar className="bg-white" collapsible="icon">
      <AppSidebarHeader />
      <ModuleSidebarContent title={title} items={items} basePath={basePath} company={company} branch={branch} />
      <ModuleSidebarFooter profile={profile} company={company} branch={branch} />
      <SidebarRail />
    </Sidebar>
  )
}

export const CollapsibleButton = ({title,icon,items,sidebarCollapse,sidebarOpen,caps,defaultOpen,iconClass,subIconClass ,itemClass}) => {
   const item ={icon}
  return (
    <Collapsible key={title} asChild defaultOpen={defaultOpen} className="group/collapsible my-0.5" >
        <SidebarMenuItem onRequestOpen={sidebarOpen} onRequestCollapse={sidebarCollapse} >
            <CollapsibleTrigger asChild>
        <SidebarMenuButton  tooltip={title} className={`text-black border-2 border-transparent hover:border-zinc-100 cursor-pointer font-Poppins ${itemClass || ''}`}>
                  {item.icon && <item.icon className={iconClass || 'font-bold'} />}
                  <span className="font-medium text-sm ml-1">{title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
            <SidebarMenuSub className="mt-1.5 space-y-1.5">
                {items?.map((subItem) => {
                const subBtnClass = subItem.className || 'text-black text-sm'
                const titleClass = subItem.titleClass || 'font-medium data-[caps=capitalize]:capitalize data-[caps=lowercase]:lowercase data-[caps=uppercase]:uppercase font-Poppins text-sm ml-1'
                const SubIcon = subItem.icon
                return (
                <SidebarMenuSubItem key={subItem.title} className="my-0.5">
                  <SidebarMenuSubButton className={`${subBtnClass} py-1.5`} style={subItem.style} asChild>
                    <Link href={subItem.url} className="flex items-center gap-2 w-full">
                      {SubIcon && <SubIcon className={subItem.iconClass || subIconClass || 'h-3.5 w-3.5 text-core'} />}
                      <span data-caps={caps} className={titleClass}>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                )})}
            </SidebarMenuSub>
            </CollapsibleContent>
        </SidebarMenuItem>
    </Collapsible>
  )
}


export const NoCollapsibleButton = ({
  name,
  active,
  url,
  icon,
  title,
  badge,
  iconClass,
}) => {
  const item = { icon }
  const {open} =useSidebar()

  return (
    <SidebarMenuItem mobileCollapse={true} key={name} className="my-0.5">
      <SidebarMenuButton
        tooltip={title}
        asChild
        isActive={active}
        className="relative text-black border-2 border-transparent hover:border-zinc-100 bg-transparent data-[active=true]:bg-zinc-200/50 data-[active=true]:hover:bg-zinc-100"
      >
        <Link href={url} className="relative flex items-center w-full">
          {item.icon && <item.icon className={iconClass || "font-bold"} />}

          <span className="font-medium font-Poppins text-sm ml-1">
            {name}
          </span>

          {/* 🔴 BADGE */}
          {open&&badge && (
            <span className="absolute bottom-0.5 right-0.5 min-w-max h-4
              px-1.5 rounded-full bg-core font-thin text-white text-[10px]
              flex items-center justify-center leading-none">
              <span className="relative">
                {badge}
              </span>
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}