/*
 * Reads a company's subscription state via the get_company_subscription_status
 * RPC (security definer — bypasses RLS the same way has_active_subscription
 * did, avoiding the silent-zero-rows gotcha on a direct table query).
 *
 * Returns one of: 'never_subscribed' | 'trialing' | 'active' | 'past_due' | 'expired'
 * — not a boolean. Callers decide what to do with each state individually
 * rather than collapsing everything into "has access / doesn't."
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @returns {Promise<string>}
 */
export async function getCompanySubscriptionStatus(supabase, companyId) {
  const { data, error } = await supabase.rpc("get_company_subscription_status", {
    p_company_id: companyId,
  })

  if (error) {
    console.error("getCompanySubscriptionStatus - RPC error:", error)
    // Fail closed — treat an error the same as never having subscribed,
    // since that's the state that blocks the most (safest default).
    return "never_subscribed"
  }

  return data
}