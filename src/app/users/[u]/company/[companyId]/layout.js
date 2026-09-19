import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/config/supabaseServer"
import { getCompanySubscriptionStatus } from "./getCompanySubscriptionStatus"
import CompanyLayoutClient from "./companyLayoutClient"

const EXEMPT_SEGMENTS = ["subscriptions", "profile"]

export default async function CompanyLayout({ children, params }) {
  const { u, companyId } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/accounts/login")
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, owner, currencies")
    .eq("id", companyId)
    .single()

  if (companyError || !company) {
    redirect(`/users/${u}`)
  }

  const { data: accessLevelsData, error: accessLevelsError } = await supabase
    .from("access_level")
    .select("*")
    .order("level_number", { ascending: true })

  if (accessLevelsError) {
    redirect(`/users/${u}`)
  }

  let accessLevel = null
  let branchId = null
  let suspended = false
  let accessLevelScope = null

  if (company.owner === user.id) {
    accessLevel = "owner"
    accessLevelScope = "company"
  } else {
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("access_level, branch, status")
      .eq("user", user.id)
      .eq("company", company.id)
      .single()

    if (staffError || !staffData) {
      redirect(`/users/${u}`)
    }

    accessLevel = staffData.access_level
    suspended = staffData.status === "suspended"

    const accessLevelRecord = accessLevelsData?.find((al) => al.key === staffData.access_level)
    accessLevelScope = accessLevelRecord?.access

    if (accessLevelScope === "branch") {
      branchId = staffData.branch
    }
  }

  // Subscription state — a string now, not a boolean. Gating decisions
  // (redirect vs. read-only) are made in the client layout, where
  // pathname is reliably known.
  const subscriptionStatus = await getCompanySubscriptionStatus(supabase, company.id)

  const { data: currenciesArray } = await supabase
    .from("currencies")
    .select("name, code, flag")
    .in("code", company.currencies || [])

  const { data: branchesData } = await supabase
    .from("branches")
    .select("*")
    .eq("company", company.id)

  const allowedBranches = branchesData || []

  // Modules available to the sidebar now come from subscription_modules —
  // an explicit row per enabled module on the company's current
  // subscription — not from comparing a plan level against
  // modules.min_plan_level, which no longer exists.
  let modulesData = []

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("company_id", company.id)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle()

  if (activeSubscription) {
    const { data: subModules } = await supabase
      .from("subscription_modules")
      .select("modules(*)")
      .eq("subscription_id", activeSubscription.id)

    modulesData = (subModules || [])
      .map((row) => row.modules)
      .filter((m) => m && m.status === "active")
  }

  const info = {
    ...company,
    id: company.id,
    accessLevel,
    accessLevelScope,
    branchId,
    hasAllBranchAccess: accessLevelScope === "company",
    suspended,
    staff_id: user.id,
    company_id: company.id,
  }

  return (
    <CompanyLayoutClient
      info={info}
      modules={modulesData}
      branches={allowedBranches}
      currencies={currenciesArray || []}
      accessLevels={accessLevelsData || []}
      subscriptionStatus={subscriptionStatus}
      exemptSegments={EXEMPT_SEGMENTS}
    >
      {children}
    </CompanyLayoutClient>
  )
}