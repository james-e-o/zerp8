"use client"

import { useParams } from "next/navigation"
import { SidebarFooter } from "@/components/ui/sidebar"
import { Settings, Users } from "lucide-react"
import { NoCollapsibleButton } from "./module-sidebar"
import ModuleSidebarFooterUser from "./module-sidebar-footer-user"

export default function ModuleSidebarFooter({ profile, company, branch }) {
  const params = useParams()

  return (
    <SidebarFooter className="bg-armylight pb-8 flex-col flex gap-6">
      <div className="flex-col flex gap-1">
        <NoCollapsibleButton
          url={`/users/${params.u}/company/${params.companyId}/branches/${params.branchId}/staff`}
          title="Staff"
          icon={Users}
          active={false}
          name="Staff"
          badge="branch"
        />
        <NoCollapsibleButton
          url={`/users/${params.u}/company/${params.companyId}/branches/${params.branchId}/settings`}
          title="Settings"
          icon={Settings}
          active={false}
          name="Settings"
          badge="branch"
        />
      </div>

      <ModuleSidebarFooterUser user={profile} u={params.u} companyId={params.companyId} branch={branch} />
    </SidebarFooter>
  )
}
