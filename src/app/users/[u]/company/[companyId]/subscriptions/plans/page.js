'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
  const [currency, setCurrency] = useState('USD')
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
          // Only active limits are offered. Hiding a limit = limit_keys.is_active = false.
          .select('bundle_id, default_value_numeric, limit_keys!inner(id, key, name, unit, value_type, measurement, is_active)')
          .eq('limit_keys.is_active', true),
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
  const selectedLimitLabels = useMemo(
    () =>
      Object.fromEntries(
        selectedLimitKeys
          .map((key) => [key, limits[key]?.name])
          .filter(([, label]) => Boolean(label))
      ),
    [selectedLimitKeys, limits]
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

      if (error) {
        console.error('Failed to price the subscription:', error)
        toast.error(error.message || 'Could not work out the price.', { id: 'subscription-price-error' })
      } else if (data && data.length > 0) {
        setTotal(Number(data[0].grand_total))
        if (data[0].currency) setCurrency(String(data[0].currency))
      }

      setPricing(false)
    }

    const debounce = setTimeout(fetchPrice, 250)
    return () => clearTimeout(debounce)
  }, [selectedIds, values, billingInterval]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    if (selectedIds.length === 0) {
      toast.error('Choose at least one module first.')
      return
    }
    setSubmitting(true)
    try {
      // The checkout is a Supabase Edge Function, not a Next.js route, so it is called through
      // the Supabase client. That sends the signed-in user's token and uses the project URL.
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          company_id: companyId,
          bundle_ids: selectedIds,
          limit_selections: buildLimitSelections(),
          billing_interval: billingInterval,
          return_path: `/users/${u}/company/${companyId}/subscriptions`,
        },
      })

      if (error) {
        // A non-2xx reply carries the function's own message in the response body.
        let message = error.message
        try {
          const body = await error.context?.json?.()
          if (body?.error) message = body.error
        } catch {
          // keep the generic message
        }
        throw new Error(message)
      }
      if (!data?.checkout_url) throw new Error('The payment page could not be opened. Please try again.')

      window.location.assign(data.checkout_url)
    } catch (err) {
      console.error('Error creating subscription checkout:', err)
      toast.error(err?.message || 'Could not start the checkout.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading plans...</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-sm tracking-tight font-bold text-foreground">Configure your subscription</h1>
        <p className="text-[11px] tracking-tighter text-muted-foreground">Choose modules and capacity for your company.</p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 gap-0.5">
        {['monthly', 'annual'].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setBillingInterval(period)}
            className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
              billingInterval === period ? 'bg-core text-white shadow' : 'text-muted-foreground hover:text-core'
            }`}
          >
            {period === 'annual' ? 'Annual — save 15%' : 'Monthly'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <main className="space-y-4 lg:col-span-2">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Choose modules and capacity</h2>
            <div className="space-y-2">
              {bundles.map((bundle) => {
                const bundleLimits = Object.fromEntries(
                  bundle.limitKeys.map((key) => [key, { name: limits[key]?.name, unit: limits[key]?.unit, value: values[key] }])
                )
                return (
                  <BundleCard key={bundle.id} bundle={bundle} selected={selectedIds.includes(bundle.id)} onToggle={toggleBundle}>
                    {bundle.limitKeys.length > 0 && (
                      <CapacityControls limits={bundleLimits} values={values} tiers={tiersByKey} onChange={updateValue} currency={currency} />
                    )}
                  </BundleCard>
                )
              })}
            </div>
          </section>
        </main>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs text-muted-foreground">Prefer to evaluate first?</p>
            <StartFreeTrialDialog label="Start 7-day free trial" />
          </div>

          <SubscriptionSummary
            bundles={selectedBundles}
            values={selectedValues}
            total={total}
            currency={currency}
            limitLabels={selectedLimitLabels}
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