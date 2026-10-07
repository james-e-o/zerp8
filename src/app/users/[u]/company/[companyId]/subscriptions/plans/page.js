'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import supabase from '@/config/supabaseClient'
import BundleCard from '@/components/subscriptions/bundle-card'
import CapacityControls from '@/components/subscriptions/capacity-controls'
import SubscriptionSummary from '@/components/subscriptions/subscription-summary'
import StartFreeTrialDialog from '@/components/subscriptions/start-free-trial-dialog'

export default function PlansPage() {
  const router = useRouter()
  const { u, companyId } = useParams()

  const [bundles, setBundles] = useState([])
  const [limits, setLimits] = useState({})
  const [tiersByKey, setTiersByKey] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [values, setValues] = useState({})
  const [billingInterval, setBillingInterval] = useState('monthly') // 'monthly' | 'annual'
  const [total, setTotal] = useState(0)
  const [pricing, setPricing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadCatalog() {
      setLoading(true)

      const [{ data: bundleRows }, { data: bundleModuleRows }, { data: bundleLimitRows }] = await Promise.all([
        supabase.from('subscription_bundles').select('*').order('sort_order'),
        supabase.from('bundle_modules').select('bundle_id, module_key, modules(name)'),
        supabase
          .from('bundle_limits')
          .select('bundle_id, default_value_numeric, limit_keys(id, key, name, unit, value_type, measurement)'),
      ])

      const modulesByBundle = {}
      ;(bundleModuleRows || []).forEach((row) => {
        modulesByBundle[row.bundle_id] = modulesByBundle[row.bundle_id] || []
        modulesByBundle[row.bundle_id].push(row.modules?.name || row.module_key)
      })

      const limitKeysByBundle = {}
      const limitsMap = {}
      const defaultsByKey = {}
      ;(bundleLimitRows || []).forEach((row) => {
        const key = row.limit_keys.key
        limitKeysByBundle[row.bundle_id] = limitKeysByBundle[row.bundle_id] || []
        limitKeysByBundle[row.bundle_id].push(key)
        limitsMap[key] = {
          limitKeyId: row.limit_keys.id,
          name: row.limit_keys.name,
          unit: row.limit_keys.unit,
          valueType: row.limit_keys.value_type,
          measurement: row.limit_keys.measurement,
        }
        if (defaultsByKey[key] === undefined) defaultsByKey[key] = row.default_value_numeric
      })

      const mappedBundles = (bundleRows || []).map((b) => ({
        id: b.id,
        key: b.key,
        name: b.name,
        description: b.description,
        base_price: Number(b.base_price),
        currency: b.currency,
        status: b.status,
        modules: modulesByBundle[b.id] || [],
        limitKeys: limitKeysByBundle[b.id] || [],
      }))

      const limitKeyIds = Object.values(limitsMap).map((l) => l.limitKeyId)
      const { data: tierRows } = await supabase
        .from('limit_tiers')
        .select('limit_key_id, tier_index, step_value, price_delta')
        .in('limit_key_id', limitKeyIds)
        .order('tier_index')

      const idToKey = Object.fromEntries(Object.entries(limitsMap).map(([key, v]) => [v.limitKeyId, key]))
      const tiersMap = {}
      ;(tierRows || []).forEach((row) => {
        const key = idToKey[row.limit_key_id]
        tiersMap[key] = tiersMap[key] || []
        tiersMap[key].push({ tierIndex: row.tier_index, value: row.step_value, priceDelta: Number(row.price_delta) })
      })

      setBundles(mappedBundles)
      setLimits(limitsMap)
      setTiersByKey(tiersMap)
      setValues(Object.fromEntries(Object.entries(defaultsByKey).map(([key, val]) => [key, val])))
      setLoading(false)
    }

    loadCatalog()
  }, [])

  const selectedBundles = useMemo(() => bundles.filter((b) => selectedIds.includes(b.id)), [bundles, selectedIds])
  const selectedLimitKeys = useMemo(
    () => [...new Set(selectedBundles.flatMap((b) => b.limitKeys))],
    [selectedBundles]
  )
  const selectedValues = useMemo(
    () => Object.fromEntries(selectedLimitKeys.map((key) => [key, values[key]])),
    [selectedLimitKeys, values]
  )

  const toggleBundle = (id) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }))

  const buildLimitSelections = () => {
    const limitSelections = {}
    selectedLimitKeys.forEach((key) => {
      const meta = limits[key]
      const tiers = tiersByKey[key] || []
      const tierIndex = tiers.find((t) => t.value === values[key])?.tierIndex
      if (meta && tierIndex !== undefined) limitSelections[meta.limitKeyId] = tierIndex
    })
    return limitSelections
  }

  // Re-prices on bundle, capacity, AND interval change — the server is the
  // only place this math happens; nothing here computes the annual discount.
  useEffect(() => {
    async function fetchPrice() {
      if (selectedIds.length === 0) {
        setTotal(0)
        return
      }

      setPricing(true)

      const { data, error } = await supabase.rpc('compute_subscription_price', {
        p_bundle_ids: selectedIds,
        p_limit_selections: buildLimitSelections(),
        p_billing_interval: billingInterval,
      })

      if (!error && data && data.length > 0) {
        setTotal(Number(data[0].grand_total))
      }

      setPricing(false)
    }

    const debounce = setTimeout(fetchPrice, 250)
    return () => clearTimeout(debounce)
  }, [selectedIds, values, billingInterval]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    setSubmitting(true)
    try {
      // Recommend pointing this at the create-subscription-checkout Edge
      // Function instead of a legacy /api route — see the security note
      // above on why that route shouldn't be trusted as-is.
      const res = await fetch('/functions/v1/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          bundle_ids: selectedIds,
          limit_selections: buildLimitSelections(),
          billing_interval: billingInterval,
        }),
      })
      const result = await res.json()

      if (result.checkout_url) {
        window.location.assign(result.checkout_url)
      } else {
        setSubmitting(false)
      }
    } catch (err) {
      console.error('Error creating subscription checkout:', err)
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading plans...</div>
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configure your subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose modules and capacity for your company.</p>
      </div>

      <div className="inline-flex rounded-full border-2 border-border bg-muted p-1 gap-1">
        {['monthly', 'annual'].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setBillingInterval(period)}
            className={`px-5 py-1.5 rounded-full font-semibold text-sm transition-all ${
              billingInterval === period ? 'bg-core text-white shadow' : 'text-muted-foreground hover:text-core'
            }`}
          >
            {period === 'annual' ? 'Annual — save 15%' : 'Monthly'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <main className="space-y-7 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Choose modules and capacity</h2>
            <div className="space-y-3">
              {bundles.map((bundle) => {
                const bundleLimits = Object.fromEntries(
                  bundle.limitKeys.map((key) => [key, { name: limits[key]?.name, unit: limits[key]?.unit, value: values[key] }])
                )
                return (
                  <BundleCard key={bundle.id} bundle={bundle} selected={selectedIds.includes(bundle.id)} onToggle={toggleBundle}>
                    {bundle.limitKeys.length > 0 && (
                      <CapacityControls limits={bundleLimits} values={values} tiers={tiersByKey} onChange={updateValue} />
                    )}
                  </BundleCard>
                )
              })}
            </div>
          </section>
        </main>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-xs text-muted-foreground">Prefer to evaluate first?</p>
            <StartFreeTrialDialog label="Start 7-day free trial" />
          </div>

          <SubscriptionSummary
            bundles={selectedBundles}
            values={selectedValues}
            total={total}
            pricing={pricing}
            billingInterval={billingInterval}
            onConfirm={handleContinue}
            loading={submitting}
          />
        </div>
      </div>
    </div>
  )
}