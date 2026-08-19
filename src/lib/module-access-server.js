import { createSupabaseServerClient } from "@/config/supabaseServer";

/**
 * Server-side check via RPC: does this company have access to the module?
 * @param {string} companyId
 * @param {string} moduleKey  - modules.key (e.g. "products")
 */
export async function isModuleEnabledServer(companyId, moduleKey) {
  if (!companyId || !moduleKey) return false;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("has_module_access", {
      p_company_id: companyId,
      p_module_key: moduleKey,
    });

    if (error) {
      console.error("[isModuleEnabledServer] RPC error:", error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error("[isModuleEnabledServer] unexpected error:", err);
    return false;
  }
}