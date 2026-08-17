
import { ChevronRight, Factory,Files,LayoutDashboard,Plus, Group,Building2,Rocket } from "lucide-react"
import {  Collapsible,  CollapsibleContent,  CollapsibleTrigger,} from "@/components/ui/collapsible"
import { Sidebar,  SidebarContent,  SidebarFooter,  SidebarHeader,SidebarTrigger,  SidebarRail, SidebarGroup,  SidebarGroupLabel,  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  SidebarMenuSub,  SidebarMenuSubButton,  SidebarMenuSubItem,} from "@/components/ui/sidebar"
import { Button,buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";    
import { useContext } from "react";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";
import { CollapsibleButton,NoCollapsibleButton } from "./branch-sidebar";

export default function BranchSidebarContent({modules, company}) {
   const params = useParams()   
   const { currentBranch } = useContext(BranchContext);

    return (
    <SidebarContent className={'bg-armylight   text-zinc-100'} >
        <SidebarGroup>
            <SidebarMenu>
                <NoCollapsibleButton className={`capitalize`} url={`/users/${params.u}/company/${params.companyId}`} title={'Dashboard'} icon={Building2} active={false} name={`${company?.name || params.companyId.toUpperCase()} Dashboard`}/>
                <NoCollapsibleButton className={`capitalize`} url={`/users/${params.u}/company/${params.companyId}/branches/${params.branchId}`} title={'Dashboard'} icon={Building2} active={false} name={`${currentBranch?.name || params.branchId.toUpperCase()} Dashboard`}/>
                {modules&&modules.length>0&&(
                    <CollapsibleButton caps={'capitalize'} defaultOpen={true} sidebarOpen={true} className={``} title={'Branch Modules'} icon={Group} 
                    items={[
                      
                        ...modules.filter(module => module.branchlevel).map((module) => ({ title: module.name, url: `/users/${params.u}/company/${params.companyId}/branches/${params.branchId}/modules/${module.key}`}))]}
                        sidebarCollapse={false}
                    />
                )}
               
            </SidebarMenu> 
        </SidebarGroup>
      </SidebarContent>
  )
}
