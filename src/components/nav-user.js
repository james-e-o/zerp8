"use client"

import {  BadgeCheck,  Bell,  ChevronsUpDown,  CreditCard,  LogOut,  Settings,  Sparkles,} from "lucide-react"
import {  Avatar,  AvatarFallback,  AvatarImage,} from "@/components/ui/avatar"
import {  DropdownMenu,  DropdownMenuContent,  DropdownMenuGroup,  DropdownMenuItem,  DropdownMenuLabel,  DropdownMenuSeparator,  DropdownMenuTrigger,} from "@/components/ui/dropdown-menu"
import {  SidebarMenu,  SidebarMenuButton,  SidebarMenuItem,  useSidebar,} from "@/components/ui/sidebar"

export function NavUser({user}){
  
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu className={'text-zinc-900'}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              variant="ghost"
              className="data-[state=open]:bg-transparent cursor-pointer data-[state=open]:border-0 border-0 hover:bg-transparent hover:text-zinc-700 data-[state=open]:text-black"
            >
              <Avatar className='items-center border inline-flex rounded-full size-7 justify-center'>
                <AvatarImage src={user&&user.avatar} width={60} height={60} className=" w-full" alt="@storeprobuilder"/>
                <AvatarFallback className="rounded-lg bg-white uppercase font-bold text-xl text-alt">{user&&user.username.charAt(1)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sm">{user&&user.username}</span>
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
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user&&user.avatar} alt={user&&user.username} />
                  <AvatarFallback className="rounded-lg">{user&&user.username.charAt(1)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-sm">{user&&user.username}</span>
                  <span className="truncate text-xs text-sm">{user&&user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

