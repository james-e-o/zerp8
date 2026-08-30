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
    accessLevelScope = accessLevelRecord?.access ?? null
    hasAllBranchAccess = accessLevelScope === "company"

    if (accessLevelScope === "branch" && staffData.branch && String(staffData.branch) !== String(branchId)) {
      redirect(`/users/${u}/company/${companyId}`)
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

  let modulesData = []

  if (currentPlanLevel !== null) {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("status", "active")
      .or(`min_plan_level.is.null,min_plan_level.lte.${currentPlanLevel}`)

    modulesData = data || []
  } else {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("status", "active")
      .is("min_plan_level", null)

    modulesData = data || []
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