
import { ChevronRight, Factory,Files,LayoutDashboard,Plus, Group,Building2,Rocket, SquareStack } from "lucide-react"
import {  Collapsible,  CollapsibleContent,  CollapsibleTrigger,} from "@/components/ui/collapsible"
import { Sidebar,  SidebarContent,  SidebarFooter,  SidebarHeader,SidebarTrigger,  SidebarRail, SidebarGroup,  SidebarGroupLabel,  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  SidebarMenuSub,  SidebarMenuSubButton,  SidebarMenuSubItem,} from "@/components/ui/sidebar"
import { Button,buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";    
import { CollapsibleButton,NoCollapsibleButton } from "./company-sidebar";

export default function CompanySidebarContent({modules, branches, company, accessLevel, accessLevelScope, branchId, suspended }) {
   const params = useParams()   

    return (
    <SidebarContent className={'bg-armylight  text-zinc-100'} >
        <SidebarGroup>
            <SidebarMenu>
                <NoCollapsibleButton className={`capitalize`} url={`/users/${params.u}/company/${params.companyId}`} title={'Dashboard'} icon={Building2} active={false} name={`${company?.name || params.companyId.toUpperCase()} Dashboard`}/>

                <CollapsibleButton caps={'uppercase'} defaultOpen={true} sidebarOpen={true} className={``} title={'Branches'} icon={SquareStack} 
                    items={[
                        
                        
                        //  ...branches.filter(branch => branch.company === company?.company_id).map((branch) => ({ title: branch.name, url: `/users/${params.u}/company/${params.companyId}/branches/${branch.branch_id}`}))
                        ...branches.map((branch) => ({ title: branch.name, url: `/users/${params.u}/company/${params.companyId}/branches/${branch.id}`})),
                        // { title: 'All Branches', url: `/users/${params.u}/company/${params.companyId}/branches`},
                    ]}
                    sidebarCollapse={false}
                    />
                    {modules&&modules.length>0&&(
                        <CollapsibleButton caps={'capitalize'} defaultOpen={true} sidebarOpen={true} className={``} title={'Company Modules'} icon={Group} 
                        items={[
                          
                            ...modules.filter(module => module.companylevel).map((module) => ({ title: module.name, url: `/users/${params.u}/company/${params.companyId}/modules/${module.key}`}))]}
                            sidebarCollapse={false}
                        />
                    )}
            </SidebarMenu> 
        </SidebarGroup>
      </SidebarContent>
  )
}
