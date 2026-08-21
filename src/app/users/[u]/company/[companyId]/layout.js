import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/config/supabaseServer"
import { getCompanySubscriptionStatus } from "./getCompanySubscriptionStatus"
import { CompanyInfoContext } from "./companyInfoProvider"
import CompanyLayoutClient from "./companyLayoutClient"

// Route segments reachable even without an active subscription.
const EXEMPT_SEGMENTS = ["subscriptions", "profile"]

export default async function CompanyLayout({ children, params }) {
  const { u, companyId } = await params
  const supabase = await createSupabaseServerClient()

  // Step 1: Auth user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/accounts/login")
  }

  // Step 2: Get company
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, owner, currencies")
    .eq("id", companyId)
    .single()

  if (companyError || !company) {
    redirect(`/users/${u}`)
  }

  // Step 3: Access levels
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

  // Step 4: Owner or staff check
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

  // Step 5: Subscription gatekeeper — delegated to a dedicated module
  const hasSubscription = await getCompanySubscriptionStatus(supabase, company.id)

  // We intentionally do not redirect here because the server-side pathname
  // check can be unreliable in this route tree and create a loop when the user
  // is already inside /subscriptions. The redirect guard is handled once in the
  // client layout shell, where pathname is known and can be compared reliably.

  // Step 6: Currencies
  const { data: currenciesArray } = await supabase
    .from("currencies")
    .select("name, code, flag")
    .in("code", company.currencies || [])

  // Step 7: Branches
  const { data: branchesData } = await supabase
    .from("branches")
    .select("*")
    .eq("company", company.id)
    console.log("branchesData", branchesData)

  // Show all company branches in the sidebar for now.
  // Access restrictions for branch-specific behavior should be enforced
  // deeper in the branch pages, not here.
  const allowedBranches = branchesData || []

  // Step 8: Modules - Fetch only modules that match current subscription plan
  // Get company's current subscription plan level
  let currentPlanLevel = null

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("product_id")
    .eq("company_id", company.id)
    .in("status", ["active", "trial"])
    .maybeSingle()

  if (subscription?.product_id) {
    const { data: planData } = await supabase
      .from("plans")
      .select("level")
      .eq("bachs_product_id", subscription.product_id)
      .maybeSingle()

    if (planData) {
      currentPlanLevel = planData.level
    }
  }

  // Fetch modules where min_plan_level IS NULL (free) OR min_plan_level <= currentPlanLevel
  let modulesData = []

  if (currentPlanLevel !== null) {
    // Company has a subscription plan - fetch modules available for this level
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("status", "active")
      .or(`min_plan_level.is.null,min_plan_level.lte.${currentPlanLevel}`)

    modulesData = data || []
  } else {
    // No subscription - only free modules (min_plan_level IS NULL)
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("status", "active")
      .is("min_plan_level", null)

    modulesData = data || []
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
      hasSubscription={hasSubscription}
      exemptSegments={EXEMPT_SEGMENTS}
    >
      {children}
    </CompanyLayoutClient>
  )
}