import Link from "next/link";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import { Button } from "@/components/ui/button";
import UsageBar from "@/components/subscriptions/usage-bar";

const STATUS_LABELS = {
  active: "Active",
  trialing: "On trial",
  past_due: "Past due",
};

export default async function UsagePage({ params }) {
  const { u, companyId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("company_id", companyId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  if (subscriptionError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load subscription usage right now.
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-border p-8 text-center">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            No active subscription
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a plan to view the modules and limits available to your
            company.
          </p>
        </div>
        <Button asChild>
          <Link href={`/users/${u}/company/${companyId}/subscriptions/plans`}>
            View plans
          </Link>
        </Button>
      </div>
    );
  }

  const [moduleResult, limitResult, usageResult] = await Promise.all([
    supabase
      .from("subscription_modules")
      .select("modules(name)")
      .eq("subscription_id", subscription.id),
    supabase
      .from("subscription_limits")
      .select(
        "limit_key_id, value_numeric, value_boolean, limit_keys(key, name, unit, value_type, measurement)",
      )
      .eq("subscription_id", subscription.id),
    supabase
      .from("usage_counters")
      .select("current_usage_numeric, limit_key_id")
      .eq("company_id", companyId),
  ]);

  if (moduleResult.error || limitResult.error || usageResult.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load the modules and limits for this subscription.
      </div>
    );
  }

  const modules = (moduleResult.data || [])
    .map((row) => row.modules?.name)
    .filter(Boolean);

  const usageByLimitId = Object.fromEntries(
    (usageResult.data || []).map((row) => [
      row.limit_key_id,
      row.current_usage_numeric ?? 0,
    ]),
  );

  const numericLimits = (limitResult.data || [])
    .filter((row) => row.limit_keys?.value_type === "numeric")
    .map((row) => ({
      key: row.limit_keys.key,
      name: row.limit_keys.name,
      current: usageByLimitId[row.limit_key_id] ?? 0,
      max: row.value_numeric ?? 0,
      unit: `${row.limit_keys.unit || ""}${row.limit_keys.measurement === "periodic" ? "/mo" : ""}`,
    }));

  const booleanLimits = (limitResult.data || []).filter(
    (row) => row.limit_keys?.value_type === "boolean",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Usage &amp; limits
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modules and capacity granted to your company&apos;s current
          subscription.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Subscription status</p>
          <p className="text-sm font-semibold text-foreground">
            {STATUS_LABELS[subscription.status] || subscription.status}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/users/${u}/company/${companyId}/subscriptions/plans`}>
            Change plan
          </Link>
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="included-modules-heading">
        <div>
          <h2
            id="included-modules-heading"
            className="text-sm font-semibold text-foreground"
          >
            Included modules
          </h2>
          <p className="text-xs text-muted-foreground">
            Modules granted by the current subscription.
          </p>
        </div>
        {modules.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {modules.map((moduleName) => (
              <li
                key={moduleName}
                className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              >
                {moduleName}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No modules are attached to this subscription.
          </p>
        )}
      </section>

      {booleanLimits.length > 0 && (
        <section
          className="space-y-3"
          aria-labelledby="included-features-heading"
        >
          <div>
            <h2
              id="included-features-heading"
              className="text-sm font-semibold text-foreground"
            >
              Included features
            </h2>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card px-4">
            {booleanLimits.map((row) => (
              <li
                key={row.limit_key_id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-foreground">{row.limit_keys.name}</span>
                <span className="text-muted-foreground">
                  {row.value_boolean ? "Included" : "Not included"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="capacity-usage-heading">
        <div>
          <h2
            id="capacity-usage-heading"
            className="text-sm font-semibold text-foreground"
          >
            Capacity usage
          </h2>
        </div>
        {numericLimits.length > 0 ? (
          <div className="rounded-lg border border-border bg-card px-4">
            {numericLimits.map((limit) => (
              <UsageBar
                key={limit.key}
                name={limit.name}
                current={limit.current}
                max={limit.max}
                unit={limit.unit}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No numeric capacity limits are configured for this subscription.
          </p>
        )}
      </section>
    </div>
  );
}
