import { createSupabaseServerClient } from "@/config/supabaseServer";


export async function isModuleEnabledServer(companyId, moduleName) {
  if (!companyId || !moduleName) return false;

  try {
    const supabase = await createSupabaseServerClient();


    // Step 1: Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('plan_key')
      .eq('company', companyId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    // Normalize module names to match plan_module_enabled.module values
    const normalizedModuleName = moduleName
      .toString()
      .trim()
      .toLowerCase()
      .replace(/_enabled$/, '');

    // Step 2: Check specific module access for this plan
    const { data: enabledEntry, error: enabledError } = await supabase
      .from('plan_module_enabled')
      .select('enabled')
      .eq('plan', subscription.plan_key)
      .eq('module', normalizedModuleName)
      .maybeSingle();

    // console.log('🔎 [SERVER] Plan module enabled lookup:', {
    //   plan: subscription.plan_key,
    //   module: normalizedModuleName,
    //   enabledEntry,
    //   enabledError,
    // });

    if (enabledError) {
      console.error(`[SERVER] Module enabled lookup error:`, enabledError);
      return false;
    }

    const result = enabledEntry?.enabled === true;
    // console.log('✅ [SERVER] Result:', result);
    return result;

  } catch (err) {
    console.error(`[SERVER] Error checking module access:`, err);
    return false;
  }
}
