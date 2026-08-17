import Image from "next/image"
import { SidebarHeader } from "@/components/ui/sidebar"
import { useSidebar } from "@/components/ui/sidebar"

export function StaffSidebarHeader({ ...props }) {
  const { open } = useSidebar()

  return (
    <SidebarHeader className={'bg-white'} {...props}>
      <div className="flex scale-[85%] justify-center items-center w-full">
        <div className="flex pt-0 md:pt-0 size-8 justify-center">
          <Image className="dark:invert w-7/8 scale-75" src="/logo.png" alt="logo" width={200} height={200} priority />
        </div>
        <p className="font-Poppins text-alt text-xl font-bold">{open ? 'NEXSHELF' : ''}</p>
      </div>
    </SidebarHeader>
  )
}

