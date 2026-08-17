import { createSupabaseServerClient } from "@/config/supabaseServer"
import SubscriptionsLayoutClient from "./subscriptionsLayoutClient"

export default async function SubscriptionsLayout({ children, params }) {
  const { companyId } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, owner")
    .eq("id", companyId)
    .single()

  let accessLevelScope = "company"

  if (company && company.owner !== user?.id) {
    const { data: accessLevelsData } = await supabase.from("access_level").select("*")

    const { data: staffData } = await supabase
      .from("staff")
      .select("access_level")
      .eq("user", user?.id)
      .eq("company", companyId)
      .single()

    const accessLevelRecord = accessLevelsData?.find((al) => al.key === staffData?.access_level)
    accessLevelScope = accessLevelRecord?.access || "branch"
  }

  return (
    <SubscriptionsLayoutClient companyName={company?.name} accessLevelScope={accessLevelScope}>
      {children}
    </SubscriptionsLayoutClient>
  )
}