import supabase from "../config/supabaseClient"
import { toast } from "sonner"

/**
 * Start a free trial for a company.
 * Calls the `start_free_trial` RPC directly. The RPC is `security definer`
 * and checks `auth.uid()` internally against company ownership/staff
 * status, so no edge function is needed as a middle layer.
 */
export async function startFreeTrial(companyId) {
  try {
    if (!companyId) {
      throw new Error("Company ID is required")
    }

    const { data, error } = await supabase.rpc("start_free_trial", {
      p_company_id: companyId,
    })

    if (error) {
      console.error("RPC error:", error)
      toast.error(error.message || "Failed to start free trial")
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      switch (data?.code) {
        case "UNAUTHORIZED":
          toast.error("Please log in to start a free trial")
          break
        case "FORBIDDEN":
          toast.error("You do not have permission to manage this company's subscription")
          break
        case "TRIAL_ALREADY_ACTIVE":
          toast.error("Your company already has an active free trial")
          break
        case "TRIAL_ALREADY_USED":
          toast.error("You have already used your free trial")
          break
        case "ACTIVE_SUBSCRIPTION_EXISTS":
          toast.error("You already have an active subscription")
          break
        case "NO_TRIAL_PLAN":
          toast.error("Free trial is not available at the moment")
          break
        default:
          toast.error(data?.error || "Failed to start free trial")
      }
      return { success: false, error: data?.error, code: data?.code }
    }

    toast.success("Free trial started successfully! Enjoy your trial 🎉")

    return {
      success: true,
      subscriptionId: data.subscription_id,
      trialEnd: data.trial_end,
    }
  } catch (err) {
    console.error("Error starting free trial:", err)
    toast.error(err.message || "Failed to start free trial. Please try again.")
    return { success: false, error: err.message }
  }
}