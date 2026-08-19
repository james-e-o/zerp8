"use client"

import {useContext} from "react"
import { ArrowBigDownDash, ChevronRight, AudioWaveform, BookOpen, Bot, Calculator, ChartCandlestick,Files, Command, Factory, FileChartLine, Frame, GalleryVerticalEnd, LayoutDashboard, Map, PieChart, Plus, Settings, Settings2, SquareTerminal,} from "lucide-react"
import { Button,buttonVariants } from "@/components/ui/button";
import { DataContext } from "@/app/users/[u]/pageLayoutProvider";
import Link from "next/link";
import {  Sidebar,  SidebarContent,  SidebarFooter,  SidebarHeader,SidebarTrigger,  SidebarRail,} from "@/components/ui/sidebar"
import {  Collapsible,  CollapsibleContent,  CollapsibleTrigger,} from "@/components/ui/collapsible"
import {  SidebarGroup,  SidebarGroupLabel,  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  SidebarMenuSub,  SidebarMenuSubButton,  SidebarMenuSubItem,} from "@/components/ui/sidebar"
import { useParams } from "next/navigation";


import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import BranchSidebarContent from "./branch-sidebar-content";
import BranchSidebarFooter from "./branch-sidebar-footer";
import { AppSidebarHeader } from "../app-sidebar/app-sidebar-header";


export function BranchSidebar({modules, company,...props }) {
    const isMobile = useIsMobile()
    const params = useParams()
    const {data,setData} = useContext(DataContext)

  return (
    <Sidebar   className={''} collapsible="icon" {...props}>
      <AppSidebarHeader/>
      <BranchSidebarContent modules={modules} company={company} />
      <BranchSidebarFooter params={params} profile={data.profile}/>
      <SidebarRail />
    </Sidebar>
  )
}

export const CollapsibleButton = ({title,icon,items,sidebarCollapse,sidebarOpen,caps,defaultOpen, itemClass}) => {
   const item ={icon}
  return (
    <Collapsible key={title} asChild defaultOpen={defaultOpen} className="group/collapsible my-0.5" >
        <SidebarMenuItem onRequestOpen={sidebarOpen} onRequestCollapse={sidebarCollapse} >
            <CollapsibleTrigger asChild>
        <SidebarMenuButton  tooltip={title} className={`text-black cursor-pointer font-Poppins ${itemClass || ''}`}>
                  {item.icon && <item.icon className='font-bold' />}
                  <span className="font-medium text-sm ml-1">{title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
            <SidebarMenuSub>
                {items?.map((subItem) => {
                const subBtnClass = subItem.className || 'text-black text-sm'
                const titleClass = subItem.titleClass || 'font-medium data-[caps=capitalize]:capitalize data-[caps=lowercase]:lowercase data-[caps=uppercase]:uppercase font-Poppins text-sm ml-1'
                return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton className={subBtnClass} style={subItem.style} asChild>
                    <Link href={subItem.url}>
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
}) => {
  const item = { icon }
  const {open} =useSidebar()

  return (
    <SidebarMenuItem mobileCollapse={true} key={name} className="my-0.5">
      <SidebarMenuButton
        tooltip={title}
        asChild
        isActive={active}
        className="relative text-black border-2 border-transparent hover:border-zinc-100 bg-transparent"
      >
        <Link href={url} className="relative flex items-center w-full">
          {item.icon && <item.icon className="font-bold" />}

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