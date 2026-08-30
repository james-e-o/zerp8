

'use client';
import { SidebarFooter } from "@/components/ui/sidebar";
import { CompanySidebarFooterUser } from "./company-sidebar-footer-user";
import { Settings, Users, LayoutDashboard, CreditCard } from "lucide-react";
import { NoCollapsibleButton } from "./company-sidebar";
import { AccessGate } from "@/components/access-gate";

export default function CompanySidebarFooter({ params, profile, company }) {
  const { u, companyId } = params;
  return (
    <SidebarFooter className={'bg-armylight  pb-8 flex-col flex gap-6'} >
      <div className="flex-col flex gap-1">
          <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/staff`} title={'Staff'} icon={Users} active={false} name={'Staff'} badge={'company'}/>

          {/* Only staff with view access to company_info can see these —
              same permission that gates the company's admin-facing settings
              and module configuration, not the basic operational Staff tab
              above. */}
          <AccessGate resource="company_info" verb="view">
            <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/modules-manager`} title={'Modules'} icon={LayoutDashboard} active={false} name={'Modules'}/>
          </AccessGate>
          <AccessGate resource="company_info" verb="view">
            <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/subscriptions`} title={'Subscriptions'} icon={CreditCard} active={false} name={'Subscriptions'}/>
          </AccessGate>

          <AccessGate resource="company_info" verb="view">
            <NoCollapsibleButton className={``} url={`/users/${u}/company/${companyId}/settings`} title={'Settings'} icon={Settings} active={false} name={'Settings'} badge={'company'}/>
          </AccessGate>

      </div>
      <CompanySidebarFooterUser user={profile} u={u} company={company} />
    </SidebarFooter>
  )
}