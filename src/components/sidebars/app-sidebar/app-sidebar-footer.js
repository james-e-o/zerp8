

import { SidebarFooter } from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { Settings } from "lucide-react";
import { NoCollapsibleButton } from "./app-sidebar";

export default function AppSidebarFooter({ profile}) {
  return (
    <SidebarFooter className={'bg-armylight  pb-8 flex-col flex gap-6'} >
      <NoCollapsibleButton className={``} url={'/users/'} title={'My Models'} icon={Settings} active={false} name={'Settings'}/>
      <NavUser user={profile} />
    </SidebarFooter>
  )
}



