
import Image from "next/image";
import { SidebarHeader } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";


export function AppSidebarHeader({...props }) {
    const { isMobile,open, state, openMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarHeader className={'bg-white '} {...props} >
        <div className="flex scale-[85%] justify-center items-center w-full ">
            <div className="flex pt-0 md:pt-0 size-7 justify-center">
                <Image className="dark:invert w-7/8 scale-75 " src="/logo.png" alt="logo" width={200} height={200} priority />
            </div>
            <p className=" scale-105 relative font-Madetommy -left-0.5 text-neutral-700 text-2xl font-extrabold">{open?'ZERP-8':''}</p>
        </div>
    </SidebarHeader>
  )
}
