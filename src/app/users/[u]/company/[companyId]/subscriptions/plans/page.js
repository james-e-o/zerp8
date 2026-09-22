// 'use client'

// import { useMemo, useState } from 'react'
// import { useParams, useRouter } from 'next/navigation'
// import BundleCard from '@/components/subscriptions/bundle-card'
// import CapacityControls from '@/components/subscriptions/capacity-controls'
// import SubscriptionSummary from '@/components/subscriptions/subscription-summary'
// import StartFreeTrialDialog from '@/components/subscriptions/start-free-trial-dialog'
// import { DUMMY_SUBSCRIPTION_BUNDLES, DUMMY_SUBSCRIPTION_LIMITS } from '@/components/subscriptions/dummy-data'
// import { getTierPrice } from '@/components/subscriptions/tiers'
// import { AlertTriangle } from 'lucide-react'

// export default function PlansPage() {
//   const router = useRouter()
//   const { u, companyId } = useParams()
//   const [selectedIds, setSelectedIds] = useState([])
//   const [values, setValues] = useState(Object.fromEntries(Object.entries(DUMMY_SUBSCRIPTION_LIMITS).map(([key, item]) => [key, item.value])))
//   const [loading, setLoading] = useState(false)

//   const selectedBundles = useMemo(() => DUMMY_SUBSCRIPTION_BUNDLES.filter((bundle) => selectedIds.includes(bundle.id)), [selectedIds])
//   const selectedLimitKeys = useMemo(() => [...new Set(selectedBundles.flatMap((bundle) => bundle.limitKeys))], [selectedBundles])
//   const selectedValues = useMemo(() => Object.fromEntries(selectedLimitKeys.map((key) => [key, values[key]])), [selectedLimitKeys, values])
//   // Total = each selected bundle's base price + the price delta for
//   // whatever tier its capacity limits are currently set to. Tier index 0
//   // is included in base_price already (getTierPrice returns 0 for it),
//   // so sliding a limit up is what actually moves this number now.
//   const total = selectedBundles.reduce((sum, bundle) => {
//     const capacityAddOn = bundle.limitKeys.reduce((s, key) => s + getTierPrice(key, values[key]), 0)
//     return sum + bundle.base_price + capacityAddOn
//   }, 0)

//   const toggleBundle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
//   const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }))

//   const handleContinue = async () => {
//     setLoading(true)
//     await new Promise((resolve) => setTimeout(resolve, 500))
//     setLoading(false)
//     router.push(`/users/${u}/company/${companyId}/subscriptions`)
//   }

//   return (
//     <div className="space-y-7">
//       <div>
//         <h1 className="text-2xl font-bold text-foreground">Configure your subscription</h1>
//         <p className="mt-1 text-sm text-muted-foreground">Choose modules and capacity for your company.</p>
//       </div>

//       <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-800">
//         <AlertTriangle className="size-4 shrink-0 mt-0.5" />
//         Backend subscription pricing is pending Bachs.io integration. This page currently uses temporary catalog data.
//       </div>

//       <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
//         <main className="space-y-7 lg:col-span-2">
//           <section>
//             <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Choose modules and capacity</h2>
//             <div className="space-y-3">
//               {DUMMY_SUBSCRIPTION_BUNDLES.map((bundle) => {
//                 const bundleLimits = Object.fromEntries(bundle.limitKeys.map((key) => [key, DUMMY_SUBSCRIPTION_LIMITS[key]]))
//                 return (
//                   <BundleCard key={bundle.id} bundle={bundle} selected={selectedIds.includes(bundle.id)} onToggle={toggleBundle}>
//                     {bundle.limitKeys.length > 0 && <CapacityControls limits={bundleLimits} values={values} onChange={updateValue} />}
//                   </BundleCard>
//                 )
//               })}
//             </div>
//           </section>
//         </main>

//         <div className="space-y-4">
//           {/* Trial CTA now sits above the summary card, and is a dialog
//               rather than a bare button — it shows the trial's included
//               modules and usage limits before the user commits. */}
//           <div className="rounded-xl border border-border bg-card p-4">
//             <p className="mb-3 text-xs text-muted-foreground">Prefer to evaluate first?</p>
//             <StartFreeTrialDialog label="Start 7-day free trial" />
//           </div>

//           <SubscriptionSummary bundles={selectedBundles} values={selectedValues} total={total} onConfirm={handleContinue} loading={loading} />
//         </div>
//       </div>
//     </div>
//   )
// }



'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import supabase from '@/config/supabaseClient'
import BundleCard from '@/components/subscriptions/bundle-card'
import CapacityControls from '@/components/subscriptions/capacity-controls'
import SubscriptionSummary from '@/components/subscriptions/subscription-summary'
import StartFreeTrialDialog from '@/components/subscriptions/start-free-trial-dialog'
import { AlertTriangle } from 'lucide-react'

export default function PlansPage() {
  const router = useRouter()
  const { u, companyId } = useParams()

  const [bundles, setBundles] = useState([])           // [{id, key, name, description, base_price, currency, modules: [names], limitKeys: [keys]}]
  const [limits, setLimits] = useState({})              // { [limitKey]: { limitKeyId, name, unit, valueType } }
  const [tiersByKey, setTiersByKey] = useState({})       // { [limitKey]: [{ tierIndex, value, priceDelta }] }
  const [selectedIds, setSelectedIds] = useState([])
  const [values, setValues] = useState({})               // { [limitKey]: numeric value currently selected }
  const [total, setTotal] = useState(0)
  const [pricing, setPricing] = useState(false)          // true while compute_subscription_price is in flight
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ---- Initial catalog load: bundles, their modules, their limits, and
  // the real price ladder for each limit — nothing hardcoded client-side.
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
        // A limit can appear under more than one bundle in theory — keep
        // the first default we see, they should agree in practice.
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

      // Real price ladder, one fetch, grouped by limit key.
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

  // ---- The price is never computed locally. Every time the selection
  // changes, we ask the database what it actually costs — this is the
  // server-verified total, the same function checkout will re-derive
  // from scratch and trust over anything the client sends.
  useEffect(() => {
    async function fetchPrice() {
      if (selectedIds.length === 0) {
        setTotal(0)
        return
      }

      setPricing(true)

      const limitSelections = {}
      selectedLimitKeys.forEach((key) => {
        const meta = limits[key]
        const tiers = tiersByKey[key] || []
        const tierIndex = tiers.find((t) => t.value === values[key])?.tierIndex
        if (meta && tierIndex !== undefined) {
          limitSelections[meta.limitKeyId] = tierIndex
        }
      })

      const { data, error } = await supabase.rpc('compute_subscription_price', {
        p_bundle_ids: selectedIds,
        p_limit_selections: limitSelections,
      })

      if (!error && data && data.length > 0) {
        setTotal(Number(data[0].grand_total))
      }

      setPricing(false)
    }

    const debounce = setTimeout(fetchPrice, 250)
    return () => clearTimeout(debounce)
  }, [selectedIds, values]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    setSubmitting(true)
    try {
      const limitSelections = {}
      selectedLimitKeys.forEach((key) => {
        const meta = limits[key]
        const tiers = tiersByKey[key] || []
        const tierIndex = tiers.find((t) => t.value === values[key])?.tierIndex
        if (meta && tierIndex !== undefined) limitSelections[meta.limitKeyId] = tierIndex
      })

      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, bundleIds: selectedIds, limitSelections }),
      })
      const result = await res.json()

      if (result.success) {
        router.push(`/users/${u}/company/${companyId}/subscriptions`)
      } else {
        setSubmitting(false)
      }
    } catch (err) {
      console.error('Error creating subscription:', err)
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
                      <CapacityControls
                        limits={bundleLimits}
                        values={values}
                        tiers={tiersByKey}
                        onChange={updateValue}
                      />
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
            onConfirm={handleContinue}
            loading={submitting}
          />
        </div>
      </div>
    </div>
  )
}