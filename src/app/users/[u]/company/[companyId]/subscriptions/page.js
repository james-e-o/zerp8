import Link from "next/link"
import { createSupabaseServerClient } from "@/config/supabaseServer"
import { Button } from "@/components/ui/button"
import StartFreeTrialDialog from "@/components/subscriptions/start-free-trial-dialog"
import { ArrowUpRight, Package, ShoppingCart, Users, Building2, UserRound, Warehouse } from "lucide-react"

const STATUS_DOT = {
  active: "bg-green-500",
  trialing: "bg-core",
  past_due: "bg-yellow-500",
  expired: "bg-gray-400",
  canceled: "bg-gray-400",
}

const STATUS_LABEL = {
  active: "Active",
  trialing: "On trial",
  past_due: "Past due",
  expired: "Expired",
  canceled: "Canceled",
}

// Icons keyed by resource_group / limit key prefix — falls back to Package.
const USAGE_ICONS = {
  products: Package,
  sales_orders: ShoppingCart,
  purchase_orders: ShoppingCart,
  crm_contacts: Users,
  branches: Building2,
  staff: UserRound,
  warehouses: Warehouse,
}

function getUsageIcon(key) {
  const prefix = key.split(".")[0].split("_")[0]
  return USAGE_ICONS[key.split(".")[0]] || USAGE_ICONS[prefix] || Package
}

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—"

function UsageStatCard({ label, current, max, unit, limitKey }) {
  const Icon = getUsageIcon(limitKey)
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  const isHigh = pct >= 80

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-core/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-core" />
        </div>
        <span className={`text-xs font-semibold ${isHigh ? "text-yellow-600" : "text-gray-400"}`}>
          {pct}%
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">
        {current.toLocaleString()}
        <span className="text-sm font-medium text-gray-400"> / {max.toLocaleString()}</span>
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${isHigh ? "bg-yellow-500" : "bg-core"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default async function SubscriptionOverviewPage({ params }) {
  const { u, companyId } = await params
  const supabase = await createSupabaseServerClient()

  const { data: currentSubscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle()

  const { data: previousSubscriptions } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["expired", "canceled"])
    .order("end_date", { ascending: false })
    .limit(5)

  let modules = []
  let usageRows = []

  if (currentSubscription) {
    const { data: modRows } = await supabase
      .from("subscription_modules")
      .select("modules(name)")
      .eq("subscription_id", currentSubscription.id)
    modules = (modRows || []).map((r) => r.modules?.name).filter(Boolean)

    const { data: limitRows } = await supabase
      .from("subscription_limits")
      .select("value_numeric, limit_keys(key, name, unit, value_type)")
      .eq("subscription_id", currentSubscription.id)

    const { data: usage } = await supabase
      .from("usage_counters")
      .select("current_usage_numeric, limit_key_id")
      .eq("company_id", companyId)

    const usageByLimitKeyId = Object.fromEntries(
      (usage || []).map((row) => [row.limit_key_id, row.current_usage_numeric])
    )

    usageRows = (limitRows || [])
      .filter((row) => row.limit_keys?.value_type === "numeric")
      .map((row) => ({
        key: row.limit_keys.key,
        label: row.limit_keys.name,
        max: row.value_numeric,
        current: usageByLimitKeyId[row.limit_key_id] ?? 0,
      }))
      .slice(0, 8)
  }

  const baseUrl = `/users/${u}/company/${companyId}/subscriptions`

  if (!currentSubscription) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6 border border-dashed border-gray-200 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-core/10 flex items-center justify-center mb-4">
          <Package className="w-6 h-6 text-core" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">No active subscription</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Your company data is safe. Choose a plan or start a free trial to unlock full access again.
        </p>
        <div className="flex gap-3 mt-6">
          <Link href={`${baseUrl}/plans`}>
            <Button className="bg-core text-white hover:bg-core/90">View plans</Button>
          </Link>
          <StartFreeTrialDialog label="Start free trial" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero summary bar */}
      <div className="rounded-2xl bg-core_light text-slate-900 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[currentSubscription.status]}`} />
            <span className="text-[13px] font-semibold uppercase tracking-wide text-core">
              {STATUS_LABEL[currentSubscription.status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {modules.map((name) => (
              <span key={name} className="text-xs tracking-tight font-medium bg-white/60 px-2.5 py-1 rounded-full">
                {name}
              </span>
            ))}
          </div>
          <p className="text-xs ml-1 text-gray-500 mt-3">
            {currentSubscription.status === "trialing"
              ? `Trial ends ${formatDate(currentSubscription.trial_end)}`
              : `Next billing ${formatDate(currentSubscription.next_billing_date)}`}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-3xl font-bold leading-none">
              ₦{Number(currentSubscription.amount || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">per month</p>
          </div>
          <Link href={`/users/${u}/company/${companyId}/modules-manager`}>
            <Button className="bg-core text-white hover:bg-core/90">Manage</Button>
          </Link>
        </div>
      </div>

      {/* Usage stat grid */}
      {usageRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Usage</h2>
            <Link
              href={`${baseUrl}/usage`}
              className="text-sm font-semibold text-core hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {usageRows.map((row) => (
              <UsageStatCard
                key={row.key}
                limitKey={row.key}
                label={row.label}
                current={row.current}
                max={row.max}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick links row */}
      <div className="flex flex-wrap gap-3">
        <Link href={`${baseUrl}/billing`}>
          <Button variant="outline" className="rounded-full border-gray-200">Billing details</Button>
        </Link>
        <Link href={`${baseUrl}/plans`}>
          <Button variant="outline" className="rounded-full border-gray-200">Change plan</Button>
        </Link>
      </div>

      {/* History table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Subscription history</h2>
        {previousSubscriptions && previousSubscriptions.length > 0 ? (
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Ended</th>
                </tr>
              </thead>
              <tbody>
                {previousSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[sub.status]}`} />
                        {STATUS_LABEL[sub.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">₦{Number(sub.amount || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(sub.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">No previous subscriptions</p>
          </div>
        )}
      </div>
    </div>
  )
}