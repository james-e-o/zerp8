"use client"

import { useEffect, useState, useContext, createContext } from "react"
import { useRouter, useParams } from "next/navigation"
import supabase from "@/config/supabaseClient"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { BranchSidebar } from "@/components/sidebars/branch-sidebar/branch-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import BranchHeader from "@/components/headers/branch-header"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { CompanyInfoContext } from "../../companyInfoProvider"
import { RefreshContext } from "@/app/users/[u]/pageLayoutProvider"
import { BranchContext } from "./branchContext"


export default function BranchLayout({ children }) {
  const router = useRouter()
  const params = useParams()
  const { refreshKey } = useContext(RefreshContext)
  const parentContext = useContext(CompanyInfoContext) // Get parent context

  const [currentBranch, setCurrentBranch] = useState()  // ← ADD CURRENT BRANCH STATE
  const [branchModules, setBranchModules] = useState([])  // ← ADD BRANCH MODULES STATE
  const [isLoading, setIsLoading] = useState(true)

  const { u, companyId, branchId } = params

  function capitalizeFirstLetter(string) {
    if (typeof string !== 'string' || string.length === 0) {
      return string; // Handle non-string or empty input
    }
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  useEffect(() => {
    // Safety timeout: prevent infinite spinner on back navigation
    const timeout = setTimeout(() => {
      console.warn("Branch layout loading timeout - forcing state reset")
      setIsLoading(false)
    }, 5000)

    async function fetchCurrentBranch() {
      try {
        // Step 1: Auth user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          toast("Please log in to continue.")
          router.push("/accounts/login")
          return
        }

        // Step 2: Fetch the specific branch
        const { data: branchData, error: branchError } = await supabase
          .from("branches_lite")
          .select("*")
          .eq("id", branchId)
          .single()

        if (branchError || !branchData) {
          toast("Branch not found.")
          router.push(`/users/${params.u}/company/${params.companyId}/branches`)
          return
        }

        // Step 3: Verify branch belongs to user's company
        if (branchData.company !== parentContext?.info?.id) {
          toast("Access denied. Branch does not belong to this company.")
          router.push(`/users/${params.u}/company/${params.companyId}/branches`)
          return
        }

        // Step 4: Store all modules for sidebar display
        setBranchModules(parentContext.modules || [])

        setCurrentBranch(branchData)

      } catch (e) {
        console.error("Branch access error:", e)
        toast("Unexpected error occurred.")
        router.push(`/users/${params.u}/company/${params.companyId}/branches`)
      } finally {
        setIsLoading(false)
        clearTimeout(timeout)
      }
    }

    if (parentContext?.info?.id && branchId) {
      fetchCurrentBranch()
    } else {
      // If parent context not ready, stop loading to prevent infinite spinner
      clearTimeout(timeout)
      setIsLoading(false)
    }

    // Cleanup: clear timeout on unmount or when dependencies change
    return () => clearTimeout(timeout)
  }, [branchId, parentContext?.info?.id])

  if (isLoading) {
    return (
      <div className='overflow-hidden flex text-core justify-center items-center h-full'>
        <Spinner className='size-8 text-army' spinning={true} />
      </div>
    )
  }

  if (!currentBranch) return null

  return (
    <BranchContext.Provider value={{ currentBranch, modules: branchModules }}>
      <CompanyInfoContext.Provider value={parentContext}>
        <SidebarProvider className="relative">
        <BranchSidebar company={parentContext.info} modules={branchModules} /> 

        <SidebarInset className="h-svh overflow-hidden static">
          <div className="flex flex-col h-full">

            <div className="h-12 border-b">
              <BranchHeader>
                <div className="flex">
                  <Button variant='ghost' size='icon' className='relative ml-3'>
                    <Bell className='h-5 w-5' />
                    <span className='absolute -top-0.5 -right-0.5 text-[9px] bg-red-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full'>3</span>
                  </Button>
                </div>
              </BranchHeader>
            </div>

            <div className="grow overflow-y-auto p-2 ">
              {children}
            </div>

          </div>
        </SidebarInset>
      </SidebarProvider>
    </CompanyInfoContext.Provider>
    </BranchContext.Provider>
  )
}



// export const ReusableBranchSidebar = ({children}) => {
//   const { info, modules } = useContext(CompanyInfoContext)
//   return (
     
//   )
// }


