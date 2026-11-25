import { createSupabaseServerClient } from "@/config/supabaseServer";

/**
 * Server-side check via RPC: does this company have FULL access to the module?
 * (Subscription active, module included.) Read-only companies return false here;
 * use getModuleAccessLevelServer when you need to tell the difference.
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

/**
 * Server-side access LEVEL for a module, via get_module_access_level:
 *   "full"       - subscription active and module included
 *   "read_only"  - company had the module before (data exists) but no longer has
 *                  active access; can view, cannot create/edit (enforced by the
 *                  database through module_gate)
 *   "none"       - never had the module, or not a member of the company
 * Any error resolves to "none".
 * @param {string} companyId
 * @param {string} moduleKey  - modules.key (e.g. "procurement")
 * @returns {Promise<"full" | "read_only" | "none">}
 */
export async function getModuleAccessLevelServer(companyId, moduleKey) {
  if (!companyId || !moduleKey) return "none";

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("get_module_access_level", {
      p_company: companyId,
      p_module_key: moduleKey,
    });

    if (error) {
      console.error("[getModuleAccessLevelServer] RPC error:", error);
      return "none";
    }

    return data === "full" || data === "read_only" ? data : "none";
  } catch (err) {
    console.error("[getModuleAccessLevelServer] unexpected error:", err);
    return "none";
  }
}