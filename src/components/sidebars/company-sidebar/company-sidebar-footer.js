
'use client';

import { SidebarFooter } from "@/components/ui/sidebar";
import { CompanySidebarFooterUser } from "./company-sidebar-footer-user";
import { Settings, Users, LayoutDashboard, CreditCard } from "lucide-react";
import { NoCollapsibleButton } from "./company-sidebar";


export default function CompanySidebarFooter({ params, profile, company }) {
  const { u, companyId } = params;

  return (
    <SidebarFooter className={'bg-armylight  pb-8 flex-col flex gap-6'} >
      <div className="flex-col flex gap-1">

          <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/staff`} title={'Staff'} icon={Users} active={false} name={'Staff'} badge={'company'}/>
  
          <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/modules-manager`} title={'Modules'} icon={LayoutDashboard} active={false} name={'Modules'}/>

          <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/subscriptions`} title={'Subscriptions'} icon={CreditCard} active={false} name={'Subscriptions'}/>
       
           <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/settings`} title={'Settings'} icon={Settings} active={false} name={'Settings'} badge={'company'}/>
      
      </div>
      <CompanySidebarFooterUser user={profile} u={u} company={company} />
    </SidebarFooter>
  )
}



