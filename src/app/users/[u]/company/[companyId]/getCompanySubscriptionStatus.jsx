/**
 * Determines whether a company currently has valid access — calls the
 * has_active_subscription RPC, which is security definer and bypasses
 * RLS. This avoids a real gotcha: querying `subscriptions` directly
 * with the user's session client silently returns zero rows if RLS is
 * enabled without a matching SELECT policy — no error, just an
 * incorrect "no subscription" result even when a valid row exists.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @returns {Promise<boolean>}
 */
export async function getCompanySubscriptionStatus(supabase, companyId) {
  const { data, error } = await supabase.rpc("has_active_subscription", {
    p_company_id: companyId,
  })

  if (error) {
    console.error("getCompanySubscriptionStatus - RPC error:", error)
    // Fail closed — an error here should not accidentally grant access.
    return false
  }
  console.log("getCompanySubscriptionStatus - RPC result:", data)

  return Boolean(data)
}