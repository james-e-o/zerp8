"use client"

import { useEffect, useState, useContext } from "react"
import { useRouter, useParams, usePathname } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { AppSidebar } from "@/components/sidebars/company-sidebar/company-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import CompanyHeader from "@/components/headers/company-dashboard-header"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { CompanyInfoContext } from "./companyInfoProvider"
import { DataContext } from "@/app/users/[u]/pageLayoutProvider"

export default function CompanyLayoutClient({
  children,
  info: initialInfo,
  modules,
  branches,
  currencies,
  accessLevels,
  hasSubscription,
  exemptSegments = ["subscriptions", "profile"],
}) {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const { u, companyId } = params

  const [info, setInfo] = useState(initialInfo)

  const isExemptRoute = (() => {
    if (!pathname) return false
    const segments = pathname.split("/").filter(Boolean)
    return exemptSegments.some((segment) => segments.includes(segment))
  })()

  useEffect(() => {
    if (!hasSubscription && !isExemptRoute) {
      const subscriptionsPath = `/users/${u}/company/${companyId}/subscriptions`
      router.replace(subscriptionsPath)
    }
  }, [hasSubscription, isExemptRoute, router, u, companyId])

  if (!hasSubscription && !isExemptRoute) {
    return (
      <div className="overflow-hidden flex text-core justify-center items-center h-full">
        <Spinner className="size-8 text-army" spinning={true} />
      </div>
    )
  }

  return (
    <CompanyInfoContext.Provider
      value={{
        info,
        setInfo,
        modules,
        branches,
        currencies,
        accessLevels,
        accessLevel: info?.accessLevel,
        accessLevelScope: info?.accessLevelScope,
        branchId: info?.branchId,
        hasAllBranchAccess: info?.hasAllBranchAccess,
        suspended: info?.suspended,
        staff_id: info?.staff_id,
        company_id: info?.company_id,
      }}
    >
      {children}
    </CompanyInfoContext.Provider>
  )
}

// ReusableCompanySidebar remains exactly the same shape as before —
// still importable from this file for any page that wraps itself in it.
export const ReusableCompanySidebar = ({ children }) => {
  const { info, modules, branches, accessLevel, accessLevelScope, branchId, suspended } =
    useContext(CompanyInfoContext)

  return (
    <SidebarProvider className="relative">
      <AppSidebar
        company={info}
        modules={modules}
        branches={branches}
        accessLevel={accessLevel}
        accessLevelScope={accessLevelScope}
        branchId={branchId}
        suspended={suspended}
      />
      <SidebarInset className="h-svh overflow-hidden static">
        <div className="flex flex-col h-full">
          <div className="h-12 border-b">
            <CompanyHeader>
              <div className="flex">
                <Button variant="ghost" size="icon" className="relative ml-3">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-red-600 translate-x-[-48.8%] translate-y-[48.9%] text-white font-semibold flex items-center justify-center size-3.5 rounded-full">
                    3
                  </span>
                </Button>
              </div>
            </CompanyHeader>
          </div>
          <div className="grow overflow-y-hidden ">
            {info?.suspended ? (
              <div className="p-4 text-center text-red-600 font-bold">
                Your access has been suspended. You cannot access modules or branches.
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}