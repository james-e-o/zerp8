'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReusableCompanySidebar } from '@/app/users/[u]/company/[companyId]/companyLayoutClient'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'plans', label: 'Subscription' },
  { key: 'usage', label: 'Usage & Limits' },
  { key: 'history', label: 'History' },
  { key: 'billing', label: 'Billing' },
]

export default function SubscriptionsLayoutClient({
  children,
  companyName,
  accessLevelScope,
}) {
  const params = useParams()
  const pathname = usePathname()
  const { u, companySlug, companyId } = params
  const companyParam = companyId ?? companySlug

  const isBranchLevel = accessLevelScope === 'branch'

  if (isBranchLevel) {
    return (
      <div className="min-h-screen font-WixMade bg-white p-2 md:p-4">
        <div className="mt-12">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Subscription Management</h2>
            <p className="text-slate-700 mb-2">
              You have branch-level access to <strong>{companyName}</strong>. Subscription management is handled by company-level administrators.
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Contact your company administrator or finance team to upgrade, downgrade, or manage subscription plans.
            </p>
            <Link href={`/users/${u}/company/${companyParam}`}>
              <Button className="w-full">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const baseUrl = `/users/${u}/company/${companyParam}/subscriptions`

  const isActive = (path) => {
    if (path === 'overview') return pathname === baseUrl
    return pathname.includes(`/subscriptions/${path}`)
  }

  return (
    <ReusableCompanySidebar>
      <div className="space-y-1 md:px-3 px-2 py-2 h-full flex-col flex overflow-hidden">
        <div className="">
          <h1 className="text-lg font-semibold tracking-tight text-core">Subscription management</h1>
        </div>

        <div className="border-b mt-1.5 border-gray-200">
          <div className="flex gap-5">
            {TABS.map(({ key, label }) => (
              <Link
                key={key}
                href={key === 'overview' ? baseUrl : `${baseUrl}/${key}`}
                className={`pb-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  isActive(key)
                    ? 'border-b-2 border-core text-core'
                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grow overflow-y-auto mt-1.5 md:pb-3">{children}</div>
      </div>
    </ReusableCompanySidebar>
  )
}