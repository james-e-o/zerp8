"use client"

import {useContext} from "react"
import { ArrowBigDownDash, ChevronRight, AudioWaveform, BookOpen, Bot, Calculator, ChartCandlestick,Files, Command, Factory, FileChartLine, Frame, GalleryVerticalEnd, LayoutDashboard, Map, PieChart, Plus, Settings, Settings2, SquareTerminal,} from "lucide-react"
import { Button,buttonVariants } from "@/components/ui/button";
import { DataContext } from "@/app/users/[u]/pageLayoutProvider"
import Link from "next/link";
import {  Sidebar,  SidebarContent,  SidebarFooter,  SidebarHeader,SidebarTrigger,  SidebarRail,} from "@/components/ui/sidebar"
import {  Collapsible,  CollapsibleContent,  CollapsibleTrigger,} from "@/components/ui/collapsible"
import {  SidebarGroup,  SidebarGroupLabel,  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  SidebarMenuSub,  SidebarMenuSubButton,  SidebarMenuSubItem,} from "@/components/ui/sidebar"
import { useParams } from "next/navigation";


import { useIsMobile } from "@/hooks/use-mobile";
import AppSidebarContent from "./app-sidebar-content";
import AppSidebarFooter from "./app-sidebar-footer";
import { AppSidebarHeader } from "./app-sidebar-header";


export function AppSidebar({ profile,companies,...props }) {
    const isMobile = useIsMobile()
    const params = useParams()
    const {data,setData} = useContext(DataContext)

  return (
    <Sidebar  className={'bg-white'} collapsible="icon" {...props}>
      <AppSidebarHeader/>
      <AppSidebarContent companies={data.companies} profile={data.profile}/>
      <AppSidebarFooter profile={data.profile}/>
      <SidebarRail />
    </Sidebar>
  )
}

export const CollapsibleButton = ({title,icon,items,sidebarCollapse,sidebarOpen,caps }) => {
   const item ={icon}
  return (
    <Collapsible key={title} asChild defaultOpen={true} className="group/collapsible my-0.5" >
        <SidebarMenuItem onRequestOpen={sidebarOpen} onRequestCollapse={sidebarCollapse} >
            <CollapsibleTrigger asChild>
            <SidebarMenuButton  tooltip={title} className={'text-black text-sm'}>
                 {item.icon && <item.icon className='font-bold' />}
                <span className="font-medium text-sm ml-1">{title}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
            <SidebarMenuSub>
                {items?.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                    <SidebarMenuSubButton className={`text-black text-sm relative`} asChild>
                    <Link href={subItem.url} className="relative w-full flex items-center">
                        <span data-caps={caps} className="font-medium data-[caps=capitalize]:capitalize data-[caps=lowercase]:lowercase data-[caps=uppercase]:uppercase tracking-tighter text-sm ml-1">{subItem.title}</span>
                        
                        {/* Badge for company type */}
                        {subItem.badge && (
                          <span className={`absolute font-thin bottom-0 right-1 min-w-max h-5 px-3 py-1.5 rounded-full text-white scale-95 text-[10px] flex items-center justify-center leading-none ${
                            subItem.badge === 'owner' 
                              ? 'bg-core' 
                              : subItem.badge === 'staff'
                              ? 'bg-orange-500'
                              : 'bg-gray-500'
                          }`}>
                            <span className="relative tracking-wider scale-[130%] text-white font-medium">{subItem.badge}</span>
                          </span>
                        )}
                    </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                ))}
            </SidebarMenuSub>
            </CollapsibleContent>
        </SidebarMenuItem>
    </Collapsible>
  )
}

export const NoCollapsibleButton = ({name,active,url,icon,badge }) => {
    const item ={icon}
  return (
    <SidebarMenuItem mobileCollapse={true}  key={name} className={'my-0.5'}>
        <SidebarMenuButton asChild isActive={active} className={'relative text-black border-2 border-transparent hover:border-zinc-100 bg-transparent'} >
            <Link href={url} className="relative flex  items-center">
                {item.icon && <item.icon className='font-bold' />}
                <span className="font-medium text-sm ml-1">{name}</span>
                {badge && (
                  <span className="absolute right-0 min-w-max h-4 px-1.5 rounded-full bg-red-600 font-semibold text-white text-[10px] flex items-center justify-center leading-none shadow-sm">
                    <span className="relative">{badge}</span>
                  </span>
                )}
            </Link>
        </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

