import { SidebarFooter } from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StaffSidebarFooter() {
  return (
    <SidebarFooter className={'bg-white pb-8 flex-col flex gap-6'}>
      <Button variant="ghost" size="sm" className="justify-start text-xs font-medium">
        <Settings className="size-4" />
        <span>Settings</span>
      </Button>
    </SidebarFooter>
  )
}

