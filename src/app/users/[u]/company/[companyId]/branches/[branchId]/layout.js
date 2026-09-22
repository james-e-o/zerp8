import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/config/supabaseServer"
import BranchLayoutClient from "./branchLayoutClient"

export default async function BranchLayout({ children, params }) {
  const { u, companyId, branchId } = await params
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
    .select("id, name, slug, owner")
    .eq("id", companyId)
    .single()

  if (companyError || !company) {
    redirect(`/users/${u}`)
  }

  const { data: accessLevelsData } = await supabase
    .from("access_level")
    .select("*")
    .order("level_number", { ascending: true })

  let accessLevel = null
  let accessLevelScope = null
  let hasAllBranchAccess = false
  let suspended = false

  if (company.owner === user.id) {
    accessLevel = "owner"
    accessLevelScope = "company"
    hasAllBranchAccess = true
  } else {
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id, access_level, branch, status")
      .eq("user", user.id)
      .eq("company", company.id)
      .single()

    if (staffError || !staffData) {
      redirect(`/users/${u}`)
    }

    accessLevel = staffData.access_level
    suspended = staffData.status === "suspended"

    const accessLevelRecord = accessLevelsData?.find((al) => al.key === staffData.access_level)
    accessLevelScope = accessLevelRecord?.access ?? null
    hasAllBranchAccess = accessLevelScope === "company"

    const { data: branchAccessRows, error: branchAccessError } = await supabase
      .rpc("get_staff_branch_access", {
        p_staff_id: staffData.id,
        p_company_id: company.id,
      })

    if (branchAccessError) {
      redirect(`/users/${u}/company/${companyId}`)
    }

    const branchAccess = (branchAccessRows || []).find(
      (row) => String(row.branch_id) === String(branchId)
    )
    const hasBranchAccess = branchAccess?.has_access === true

    if (!hasBranchAccess) {
      redirect(`/users/${u}/company/${companyId}/branches/branch-unauthorized?reason=branch-access&branchId=${branchId}`)
    }
  }

  const { data: branchData, error: branchError } = await supabase
    .from("branches")
    .select("*, branch_info(*)")
    .eq("id", branchId)
    .single()

  if (branchError || !branchData) {
    redirect(`/users/${u}/company/${companyId}/branches`)
  }

  if (branchData.company !== company.id) {
    redirect(`/users/${u}/company/${companyId}/branches`)
  }

  const infoRow = Array.isArray(branchData.branch_info)
    ? branchData.branch_info[0]
    : branchData.branch_info

  const currentBranch = {
    ...branchData,
    ...infoRow,
    branch_info: undefined,
  }

  // Modules now come from subscription_modules — an explicit row per
  // module this company's active/trialing subscription actually grants.
  // No plan-level comparison, no modules.status filter (that column no
  // longer exists — bundle status is what gates a module now, and it's
  // already accounted for at the moment subscription_modules was seeded).
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

    modulesData = (subModules || []).map((row) => row.modules).filter(Boolean)
  }

  const companyInfo = {
    ...company,
    id: company.id,
    accessLevel,
    accessLevelScope,
    branchId,
    hasAllBranchAccess,
    suspended,
    staff_id: user.id,
    company_id: company.id,
  }

  return (
    <BranchLayoutClient
      currentBranch={currentBranch}
      modules={modulesData}
      company={companyInfo}
    >
      {children}
    </BranchLayoutClient>
  )
}