
import { SidebarFooter } from "@/components/ui/sidebar";
import { BranchSidebarFooterUser } from "./branch-sidebar-footer-user";
import { Settings, Users, Sparkles } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { NoCollapsibleButton,CollapsibleButton } from "./branch-sidebar";

export default function BranchSidebarFooter({ params, profile, branch, onAssistantClick }) {
  const { u, companyId,branchId } = params 
  return (
    <SidebarFooter className={'bg-armylight  pb-8 flex-col flex gap-6'} >
      <div className="flex-col flex gap-1">
        
        <SidebarMenuItem className="w-fit mb-4">
          <SidebarMenuButton
            type="button"
            tooltip="Zerp-8 AI"
            onClick={onAssistantClick}
            className="w-fit max-w-full cursor-pointer whitespace-nowrap bg-blue-50 hover:bg-blue-100 hover:text-blue-500 text-blue-500"
          >
            <Sparkles className="" />
            <span className="ml-1 whitespace-nowrap font-Poppins text-sm font-medium">Zerp8 AI</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
       
        <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/branches/${branchId}/staff`} title={'Staff'} icon={Users} active={false} name={'Staff'} badge={'branch'}/>
        <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/branches/${branchId}/settings`} title={'Settings'} icon={Settings} active={false} name={'Settings'} badge={'branch'}/>
      </div>
      <BranchSidebarFooterUser user={profile} u={u} companyId={companyId} branch={branch} />
    </SidebarFooter>
  )
}



