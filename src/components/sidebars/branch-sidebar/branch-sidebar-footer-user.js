"use client"

import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { LogOut, ChevronsUpDown, Building2, Home } from "lucide-react"
import supabase from "../../../config/supabaseClient"
import { toast } from "sonner"

export function BranchSidebarFooterUser({ user, u, companyId, branch }) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const branchName = branch?.name?.trim() || "Branch"
  const branchInitial = branch?.isheadoffice ? "HO" : branchName.charAt(0).toUpperCase()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Logged out successfully")
      router.push("/accounts/login")
    } catch (err) {
      console.error("Logout error:", err)
      toast.error("Failed to log out")
    }
  }

  return (
    <SidebarMenu className="text-zinc-900">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" variant="ghost" className="data-[state=open]:bg-transparent cursor-pointer data-[state=open]:border-0 border-0 hover:bg-transparent hover:text-zinc-700 data-[state=open]:text-black">
              <Avatar className="items-center border inline-flex rounded-full size-7 justify-center">
                <AvatarFallback className="rounded-lg text-xl text-core font-bold uppercase">{branchInitial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-semibold">{branchName}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg font-semibold text-core uppercase">{branchInitial}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{branchName}</span>
                  <span className="truncate text-xs">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="text-army" />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Building2 className="size-4 text-army" />
                <span>Branch Info</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="text-army" />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push(`/users/${u}/company/${companyId}`)}>
                <Home className="size-4 text-army" />
                <span>Back to Company Dashboard</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="text-army" />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4 text-army" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}