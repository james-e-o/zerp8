import Link from "next/link"
import { createSupabaseServerClient } from "@/config/supabaseServer"
import { Button } from "@/components/ui/button"
import StartFreeTrialButton from "./StartFreeTrialButton"

const getStatusBadgeColor = (status) => {
  const colors = {
    active: "bg-green-100 text-green-800",
    trialing: "bg-blue-100 text-blue-800",
    paused: "bg-yellow-100 text-yellow-800",
    past_due: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-800",
    canceled: "bg-gray-100 text-gray-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

const formatDate = (date) => {
  if (!date) return "N/A"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default async function SubscriptionOverviewPage({ params }) {
  const { u, companyId } = await params
  const supabase = await createSupabaseServerClient()

  const { data: currentSubscription } = await supabase
    .from("subscriptions")
    .select("*, plan:plans!subscriptions_product_id_fkey(*)")
    .eq("company_id", companyId)
    .in("status", ["active", "trial"])
    .maybeSingle()

  const { data: previousSubscriptions } = await supabase
    .from("subscriptions")
    .select("*, plan:plans!subscriptions_product_id_fkey(*)")
    .eq("company_id", companyId)
    .in("status", ["expired", "paused", "past_due", "canceled"])
    .order("end_date", { ascending: false })

  const { data: plansData } = await supabase
    .from("plans")
    .select("*")
    .neq("bachs_product_id", "trial")
    .order("created_at", { ascending: true })

  const currentPlan =
    currentSubscription?.product_id
      ? (plansData || []).find((p) => p.bachs_product_id === currentSubscription.product_id) || null
      : null

  const getCurrentPlanTitle = () => {
    if (currentSubscription?.plan_name) {
      return currentSubscription.plan_name
    }
    if (currentSubscription?.plan?.title) {
      return currentSubscription.plan.title
    }
    if (currentSubscription?.plan?.name) {
      return currentSubscription.plan.name
    }
    return currentPlan?.title || currentPlan?.name || "Unknown Plan"
  }

  const isSubscriptionExpired = () => {
    if (!currentSubscription) return false
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (currentSubscription.status === "trial" && currentSubscription.trial_end) {
      const trialEnd = new Date(currentSubscription.trial_end)
      trialEnd.setHours(0, 0, 0, 0)
      return today > trialEnd
    }
    
    if (currentSubscription.end_date) {
      const endDate = new Date(currentSubscription.end_date)
      endDate.setHours(0, 0, 0, 0)
      return today > endDate
    }
    
    return false
  }

  const hasExpired = isSubscriptionExpired()

  const baseUrl = `/users/${u}/company/${companyId}/subscriptions`

  return (
    <div className="space-y-6">
      {currentSubscription && !hasExpired ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6 shadow">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Current Plan</h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(currentSubscription.status)}`}
              >
                {currentSubscription.status === "trial"
                  ? "On Trial"
                  : currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
              </span>
            </div>

            <div className="mb-6">
              <p className="text-2xl font-bold text-slate-900">{getCurrentPlanTitle()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {currentPlan?.description || "Active subscription"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Amount</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">
                    ${currentSubscription.amount || "0"}
                  </span>
                  <span className="text-xs text-gray-600">/{currentSubscription.auto_renew ? "mo" : "once"}</span>
                </div>
              </div>

              {currentSubscription.status === "trial" && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Free Trial</p>
                  <p className="text-xs text-slate-900 leading-relaxed">
                    <span className="font-medium">{formatDate(currentSubscription.trial_start)}</span>
                    <br />
                    <span className="text-gray-600">to</span>
                    <br />
                    <span className="font-medium">{formatDate(currentSubscription.trial_end)}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {currentSubscription.status === "trial" ? "Trial Ends" : "Next Payment"}
              </p>
              <p className="text-sm font-medium text-slate-900">
                {formatDate(
                  currentSubscription.status === "trial"
                    ? currentSubscription.trial_end
                    : currentSubscription.next_billing_date
                )}
              </p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Actions</h3>
            <div className="space-y-3">
              <Link href={`${baseUrl}/plans`} className="block">
                <Button className="w-full bg-core text-white hover:bg-core/90">Upgrade Plan</Button>
              </Link>
              <Link href={`${baseUrl}/payments`} className="block">
                <Button variant="outline" className="w-full">Manage Payment Method</Button>
              </Link>
              <Link href={`${baseUrl}/billing`} className="block">
                <Button variant="outline" className="w-full">Update Billing Address</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-blue-50 border border-blue-200 flex flex-col justify-center items-center rounded-lg p-6 shadow">
            <p className="text-blue-900 text-lg font-semibold">
              You don't have an active subscription
            </p>
            <p className="text-blue-700 text-sm mt-2">
              Start a subscription to unlock all features and get premium support.
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Actions</h3>
            <div className="space-y-3">
              <Link href={`${baseUrl}/plans`} className="block">
                <Button className="w-full bg-core text-white hover:bg-core/90">View Plans</Button>
              </Link>
              <div className="block">
                <StartFreeTrialButton
                  className="w-full bg-linear-to-r from-orange-400 via-army to-core text-white hover:bg-core/90"
                  label="Start Free Trial"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-6 shadow">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Subscriptions history</h3>
        {previousSubscriptions && previousSubscriptions.length > 0 ? (
          <div className="space-y-3">
            {previousSubscriptions.map((sub) => (
              <div key={sub.id} className="py-4 border-b last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-900">
                    {sub.plan_name || sub.plan?.title || sub.plan?.name || "Unknown Plan"}
                  </p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(sub.status)}`}
                  >
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {sub.status === "expired"
                    ? "Expired on"
                    : sub.status === "paused"
                      ? "Paused on"
                      : "Ended on"}{" "}
                  {formatDate(sub.end_date)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
            <p className="text-gray-500 text-sm">No previous subscriptions</p>
          </div>
        )}
      </div>
    </div>
  )
}