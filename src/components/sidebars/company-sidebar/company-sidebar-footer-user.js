"use client"

import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {  DropdownMenu,  DropdownMenuContent,  DropdownMenuGroup,  DropdownMenuItem,  DropdownMenuLabel,  DropdownMenuSeparator,  DropdownMenuTrigger,} from "@/components/ui/dropdown-menu"
import {  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  useSidebar,} from "@/components/ui/sidebar"
import { LogOut, ChevronsUpDown, User, Home } from "lucide-react"
import  supabase  from "../../../config/supabaseClient"
import { toast } from "sonner"

export function CompanySidebarFooterUser({ user, u }) {
  const { isMobile } = useSidebar()
  const router = useRouter()

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
    <SidebarMenu className={"text-zinc-900"}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              variant="ghost"
              className="data-[state=open]:bg-transparent cursor-pointer data-[state=open]:border-0 border-0 hover:bg-transparent hover:text-zinc-700 data-[state=open]:text-black"
            >
              <Avatar className="items-center border inline-flex rounded-full size-7 justify-center">
                <AvatarImage
                  src={user && user.avatar}
                  width={60}
                  height={60}
                  className="w-full"
                  alt={user && user.username}
                />
                <AvatarFallback className="rounded-lg text-xl text-core font-bold uppercase">{user&&user.username.charAt(1)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-semibold">{user && user.username}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* User Info Header */}
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user && user.avatar} alt={user && user.username} />
                  <AvatarFallback className="rounded-lg font-semibold text-core uppercase">{user&&user.username.charAt(1)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user && user.username}</span>
                  <span className="truncate text-xs">{user && user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className={'text-army'}/>

            {/* Account Section */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="size-4 text-army" />
                <span>Profile</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className={'text-army'}/>

            {/* Quick Actions */}
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push(`/users/${u}`)}>
                <Home className="size-4 text-army" />
                <span>Back to User Dashboard</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className={'text-army'}/>

            {/* Session */}
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
