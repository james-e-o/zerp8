"use client"

import { useEffect, useState, useContext } from "react"
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
  const parentContext = useContext(CompanyInfoContext)

  const [currentBranch, setCurrentBranch] = useState()
  const [branchModules, setBranchModules] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const { u, companyId, branchId } = params

  useEffect(() => {
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

        // Step 2: Fetch the branch, embedding its sensitive info row —
        // new schema: `branches` (basic) + `branch_info` (sensitive),
        // not the retired `branches_lite` table.
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("*, branch_info(*)")
          .eq("id", branchId)
          .single()

        if (branchError || !branchData) {
          toast("Branch not found.")
          router.push(`/users/${u}/company/${companyId}/branches`)
          return
        }

        // Step 3: Verify branch belongs to this company
        if (branchData.company !== parentContext?.info?.id) {
          toast("Access denied. Branch does not belong to this company.")
          router.push(`/users/${u}/company/${companyId}/branches`)
          return
        }

        // Step 4: Verify branch-scoped staff can only view their assigned
        // branch — company-scope roles and the owner (hasAllBranchAccess)
        // can view any branch. This check was previously missing entirely.
        if (!parentContext?.hasAllBranchAccess && parentContext?.branchId !== branchId) {
          toast("You don't have access to this branch.")
          router.push(`/users/${u}/company/${companyId}`)
          return
        }

        // Step 5: Flatten branch_info onto the branch object for convenience.
        // PostgREST returns a single object (not an array) here because
        // branch_info's PK IS branches.id — a strict one-to-one relationship.
        const infoRow = Array.isArray(branchData.branch_info)
          ? branchData.branch_info[0]
          : branchData.branch_info

        setCurrentBranch({ ...branchData, ...infoRow, branch_info: undefined })
        setBranchModules(parentContext.modules || [])
      } catch (e) {
        console.error("Branch access error:", e)
        toast("Unexpected error occurred.")
        router.push(`/users/${u}/company/${companyId}/branches`)
      } finally {
        setIsLoading(false)
        clearTimeout(timeout)
      }
    }

    if (parentContext?.info?.id && branchId) {
      fetchCurrentBranch()
    } else {
      clearTimeout(timeout)
      setIsLoading(false)
    }

    return () => clearTimeout(timeout)
  }, [branchId, parentContext?.info?.id, parentContext?.branchId, parentContext?.hasAllBranchAccess])

  if (isLoading) {
    return (
      <div className="overflow-hidden flex text-core justify-center items-center h-full">
        <Spinner className="size-8 text-army" spinning={true} />
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
              <div className="h-12 border-b border-border">
                <BranchHeader>
                  <div className="flex">
                    <Button variant="ghost" size="icon" className="relative ml-3">
                      <Bell className="h-5 w-5" />
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-rose-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full">
                        3
                      </span>
                    </Button>
                  </div>
                </BranchHeader>
              </div>

              <div className="grow overflow-y-auto p-2 bg-background">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </CompanyInfoContext.Provider>
    </BranchContext.Provider>
  )
}