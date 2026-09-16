'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BundleCard from '@/components/subscriptions/bundle-card'
import CapacityControls from '@/components/subscriptions/capacity-controls'
import SubscriptionSummary from '@/components/subscriptions/subscription-summary'
import StartFreeTrialButton from '@/components/subscriptions/start-free-trial-button'
import { DUMMY_SUBSCRIPTION_BUNDLES, DUMMY_SUBSCRIPTION_LIMITS } from '@/components/subscriptions/dummy-data'

export default function PlansPage() {
  const router = useRouter()
  const { u, companyId } = useParams()
  const [selectedIds, setSelectedIds] = useState([])
  const [values, setValues] = useState(Object.fromEntries(Object.entries(DUMMY_SUBSCRIPTION_LIMITS).map(([key, item]) => [key, item.value])))
  const [loading, setLoading] = useState(false)
  const selectedBundles = useMemo(() => DUMMY_SUBSCRIPTION_BUNDLES.filter((bundle) => selectedIds.includes(bundle.id)), [selectedIds])
  const selectedLimitKeys = useMemo(() => [...new Set(selectedBundles.flatMap((bundle) => bundle.limitKeys))], [selectedBundles])
  const selectedValues = useMemo(() => Object.fromEntries(selectedLimitKeys.map((key) => [key, values[key]])), [selectedLimitKeys, values])
  const total = selectedBundles.reduce((sum, bundle) => sum + bundle.base_price, 0)
  const toggleBundle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const handleContinue = async () => {
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setLoading(false)
    router.push(`/users/${u}/company/${companyId}/subscriptions`)
  }
  return <div className="space-y-7"><div><h1 className="text-2xl font-bold text-slate-900">Configure your subscription</h1><p className="mt-1 text-sm text-gray-600">Choose modules and capacity for your company.</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Backend subscription pricing is pending Bachs.io integration. This page currently uses temporary catalog data.</div><div className="grid grid-cols-1 gap-8 lg:grid-cols-3"><main className="space-y-7 lg:col-span-2"><section><h2 className="mb-3 text-xs font-semibold uppercase text-gray-500">Choose modules and capacity</h2><div className="space-y-3">{DUMMY_SUBSCRIPTION_BUNDLES.map((bundle) => { const bundleLimits = Object.fromEntries(bundle.limitKeys.map((key) => [key, DUMMY_SUBSCRIPTION_LIMITS[key]])); return <BundleCard key={bundle.id} bundle={bundle} selected={selectedIds.includes(bundle.id)} onToggle={toggleBundle}>{bundle.limitKeys.length > 0 && <CapacityControls limits={bundleLimits} values={values} onChange={updateValue} />}</BundleCard> })}</div></section></main><div><SubscriptionSummary bundles={selectedBundles} values={selectedValues} total={total} onConfirm={handleContinue} loading={loading} /><div className="mt-4 rounded-lg border border-gray-200 bg-white p-4"><p className="mb-3 text-xs text-gray-500">Prefer to evaluate first?</p><StartFreeTrialButton label="Start 7-day free trial" /></div></div></div></div>
}
