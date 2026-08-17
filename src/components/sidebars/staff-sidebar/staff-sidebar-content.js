import { LayoutDashboard, Briefcase } from "lucide-react"
import { SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function StaffSidebarContent() {
  const params = useParams()

  return (
    <SidebarContent className={'bg-[white] text-zinc-100'}>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href={`/staff/${params.staffId}`} className="no-underline">
              <SidebarMenuButton tooltip={'Dashboard'} className="text-black font-Poppins">
                <LayoutDashboard className="size-4" />
                <span className="font-medium text-xs">Dashboard</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href={`/staff/${params.staffId}/branches`} className="no-underline">
              <SidebarMenuButton tooltip={'Branches'} className="text-black font-Poppins">
                <Briefcase className="size-4" />
                <span className="font-medium text-xs">Branches</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  )
}

