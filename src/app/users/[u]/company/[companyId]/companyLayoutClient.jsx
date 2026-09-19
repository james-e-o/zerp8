"use client"

import { useEffect, useState, useContext } from "react"
import { useRouter, useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { Spinner } from "@/components/ui/spinner"
import { AppSidebar } from "@/components/sidebars/company-sidebar/company-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import CompanyHeader from "@/components/headers/company-dashboard-header"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { CompanyInfoContext } from "./companyInfoProvider"

export default function CompanyLayoutClient({
  children,
  info: initialInfo,
  modules,
  branches,
  currencies,
  accessLevels,
  subscriptionStatus,
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

  // Only a company that has NEVER subscribed gets hard-blocked. A company
  // with subscription history whose access has since lapsed keeps its
  // data visible — see the expired/past_due banner below instead.
  const isBlocked = subscriptionStatus === "never_subscribed" && !isExemptRoute

  useEffect(() => {
    if (isBlocked) {
      router.replace(`/users/${u}/company/${companyId}/subscriptions`)
    }
  }, [isBlocked, router, u, companyId])

  if (isBlocked) {
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
        subscriptionStatus,
      }}
    >
      {children}
    </CompanyInfoContext.Provider>
  )
}

function SubscriptionStatusBanner({ status, u, companyId }) {
  if (status === "expired") {
    return (
      <div className="px-4 py-2 bg-gray-800 text-white text-sm flex items-center justify-between">
        <span>Your subscription has ended. Your data is safe, but some actions are restricted.</span>
        <Link href={`/users/${u}/company/${companyId}/subscriptions/plans`} className="underline font-semibold">
          Renew
        </Link>
      </div>
    )
  }
  if (status === "past_due") {
    return (
      <div className="px-4 py-2 bg-yellow-500 text-white text-sm flex items-center justify-between">
        <span>Your last payment failed. Update your payment method to avoid losing access.</span>
        <Link href={`/users/${u}/company/${companyId}/subscriptions/billing`} className="underline font-semibold">
          Update payment
        </Link>
      </div>
    )
  }
  return null
}

export const ReusableCompanySidebar = ({ children }) => {
  const { info, modules, branches, accessLevel, accessLevelScope, branchId, suspended, subscriptionStatus } =
    useContext(CompanyInfoContext)
  const params = useParams()
  const { u, companyId } = params

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
          <SubscriptionStatusBanner status={subscriptionStatus} u={u} companyId={companyId} />
          <div className="grow overflow-y-hidden">
            {info?.suspended ? (
              <div className="p-3 text-center text-red-600 font-bold">
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