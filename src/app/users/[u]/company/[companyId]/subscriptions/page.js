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

// Money is shown in the subscription's own currency (USD unless the subscription says otherwise).
const formatMoney = (amount, currency) => {
  const value = Number(amount || 0)
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value)
  } catch {
    return `${currency || "USD"} ${value.toLocaleString()}`
  }
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
    <div className="rounded-lg border border-gray-100 bg-white p-3 font-sans">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-md bg-core/10">
          <Icon className="size-4 text-core" />
        </div>
        <span className={`text-xs font-semibold ${isHigh ? "text-yellow-600" : "text-gray-400"}`}>
          {pct}%
        </span>
      </div>
      <p className="text-xl font-semibold leading-none text-slate-900">
        {current.toLocaleString()}
        <span className="text-xs font-medium text-gray-400"> / {max.toLocaleString()}</span>
      </p>
      <p className="mt-1 text-[11px] text-gray-500">{label}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
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
      .select("value_numeric, limit_keys(key, name, unit, value_type, is_active)")
      .eq("subscription_id", currentSubscription.id)

    const { data: usage } = await supabase
      .from("usage_counters")
      .select("current_usage_numeric, limit_key_id")
      .eq("company_id", companyId)

    const usageByLimitKeyId = Object.fromEntries(
      (usage || []).map((row) => [row.limit_key_id, row.current_usage_numeric])
    )

    usageRows = (limitRows || [])
      .filter((row) => row.limit_keys?.value_type === "numeric" && row.limit_keys?.is_active !== false)
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center font-sans">
        <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-core/10">
          <Package className="size-5 text-core" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">No active subscription</h2>
        <p className="mt-1 max-w-sm text-xs text-gray-500">
          Your company data is safe. Choose a plan or start a free trial to unlock full access again.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={`${baseUrl}/plans`}>
            <Button size="sm" className="bg-core text-white hover:bg-core/90">View plans</Button>
          </Link>
          <StartFreeTrialDialog label="Start free trial" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Hero summary bar */}
      <div className="flex flex-col gap-3 rounded-lg bg-core_light p-4 text-slate-900 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[currentSubscription.status]}`} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-core">
              {STATUS_LABEL[currentSubscription.status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {modules.map((name) => (
              <span key={name} className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium tracking-tight">
                {name}
              </span>
            ))}
          </div>
          <p className="ml-1 mt-2 text-[11px] text-gray-500">
            {currentSubscription.status === "trialing"
              ? `Trial ends ${formatDate(currentSubscription.trial_end)}`
              : `Next billing ${formatDate(currentSubscription.next_billing_date)}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-semibold leading-none">
              {formatMoney(currentSubscription.amount, currentSubscription.currency)}
            </p>
            <p className="text-xs text-gray-500 mt-1">per month</p>
          </div>
          <Link href={`/users/${u}/company/${companyId}/modules-manager`}>
            <Button size="sm" className="bg-core text-white hover:bg-core/90">Manage</Button>
          </Link>
        </div>
      </div>

      {/* Usage stat grid */}
      {usageRows.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-gray-500">Usage</h2>
            <Link
              href={`${baseUrl}/usage`}
              className="flex items-center gap-1 text-xs font-semibold text-core hover:underline"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
      <div className="flex flex-wrap gap-2">
        <Link href={`${baseUrl}/billing`}>
          <Button variant="outline" className="rounded-full border-gray-200">Billing details</Button>
        </Link>
        <Link href={`${baseUrl}/plans`}>
          <Button variant="outline" className="rounded-full border-gray-200">Change plan</Button>
        </Link>
      </div>

      {/* History table */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">Subscription history</h2>
        {previousSubscriptions && previousSubscriptions.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Ended</th>
                </tr>
              </thead>
              <tbody>
                {previousSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[sub.status]}`} />
                        {STATUS_LABEL[sub.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{formatMoney(sub.amount, sub.currency)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(sub.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400">No previous subscriptions</p>
          </div>
        )}
      </div>
    </div>
  )
}