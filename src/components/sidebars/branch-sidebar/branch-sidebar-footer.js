
import { SidebarFooter } from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { Settings,Users,Link2, SquaresSubtract,LayoutDashboard } from "lucide-react";
import { NoCollapsibleButton,CollapsibleButton } from "./branch-sidebar";

export default function BranchSidebarFooter({ params, profile}) {
  const { u, companyId,branchId } = params 
  return (
    <SidebarFooter className={'bg-armylight  pb-8 flex-col flex gap-6'} >
      <div className="flex-col flex gap-1">
        <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/branches/${branchId}/staff`} title={'Staff'} icon={Users} active={false} name={'Staff'} badge={'branch'}/>
        <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/branches/${branchId}/settings`} title={'Settings'} icon={Settings} active={false} name={'Settings'} badge={'branch'}/>
      </div>
      <NavUser user={profile} />
    </SidebarFooter>
  )
}



