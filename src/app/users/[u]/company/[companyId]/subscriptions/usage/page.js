import Link from 'next/link'
import { Button } from '@/components/ui/button'
import UsageBar from '@/components/subscriptions/usage-bar'
import { DUMMY_SUBSCRIPTION_LIMITS, DUMMY_SUBSCRIPTION_USAGE } from '@/components/subscriptions/dummy-data'

export default async function UsagePage({ params }) {
  const { u, companyId } = await params
  const entries = Object.entries(DUMMY_SUBSCRIPTION_LIMITS)
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Usage &amp; limits</h1><p className="mt-1 text-sm text-gray-600">See how much of your subscription your company is using.</p></div><Link href={`/users/${u}/company/${companyId}/subscriptions/plans`}><Button className="bg-core text-white">Increase capacity</Button></Link></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Usage is currently shown from temporary frontend data until the subscription backend is connected.</div><div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">Current limits</h2>{entries.map(([key, limit]) => <UsageBar key={key} name={key.replaceAll('_', ' ')} current={DUMMY_SUBSCRIPTION_USAGE[key] || 0} max={limit.value} unit={limit.unit} />)}</div></div>
}
