
import { useContext } from "react"
import { ChevronRight, Factory,Files,Handshake,LayoutDashboard,Plus, Receipt, Rocket } from "lucide-react"
import {  Collapsible,  CollapsibleContent,  CollapsibleTrigger,} from "@/components/ui/collapsible"
import { Sidebar,  SidebarContent,  SidebarFooter,  SidebarHeader,SidebarTrigger,  SidebarRail, SidebarGroup,  SidebarGroupLabel,  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  SidebarMenuSub,  SidebarMenuSubButton,  SidebarMenuSubItem,} from "@/components/ui/sidebar"
import { Button,buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";    
import { DataContext } from "@/app/users/[u]/pageLayoutProvider"
import { CollapsibleButton,NoCollapsibleButton } from "./app-sidebar";

export default function AppSidebarContent({ profile,companies}) {
   const params = useParams()
   const { data } = useContext(DataContext)
    return (
    <SidebarContent className={'bg-armylight text-zinc-100 text-sm'} >
        <SidebarGroup>
            <Link href={`/users/${params.u}/new-company`} className="no-underline">
            <SidebarMenuButton tooltip={'new company'} size="lg" className=" hover:bg-core/90 mt-3 h-10 cursor-pointer bg-core">
                <div className="bg-transparent scale-125 flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Rocket className="size-4 text-white font-bold" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate text-white font-medium text-sm">Launch New Company</span>
                </div>
            </SidebarMenuButton>
            </Link>
        </SidebarGroup>
        <SidebarGroup>
            <SidebarMenu>
                <NoCollapsibleButton className={``} url={`/users/${params.u}`} title={'Dashboard'} icon={LayoutDashboard} active={false} name={'Dashboard'}/>
                {companies&&companies.length>0&&(
                    <CollapsibleButton caps={'uppercase'} sidebarOpen={true} className={``} title={'Companies'} icon={Factory} 
                        items={companies.map((company)=>({title:company.name,url:`/users/${params.u}/company/${company.id}`,badge:company.badge}))}
                        sidebarCollapse={false}
                    />
                )}
                <NoCollapsibleButton className={``} url={`/users/${params.u}`} title={'Reports'} icon={Files} active={false} name={'Reports'}/>
                <NoCollapsibleButton className={``} url={`/users/${params.u}/billing`} title={'Billing'} icon={Receipt} active={false} name={'Billing & Plans'}/>
                <NoCollapsibleButton
                  className={``}
                  url={`/users/${params.u}/company-invites`}
                  title={'Company Invites'}
                  icon={Handshake}
                  active={false}
                  name={'Company Invites'}
                  badge={data?.pendingInvitesCount > 0 ? (data.pendingInvitesCount > 99 ? '99+' : data.pendingInvitesCount) : null}
                />
               
            </SidebarMenu> 
        </SidebarGroup>
      </SidebarContent>
  )
}
