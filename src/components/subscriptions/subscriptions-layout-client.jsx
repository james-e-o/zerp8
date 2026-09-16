'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReusableCompanySidebar } from '@/app/users/[u]/company/[companyId]/companyLayoutClient'

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
      <div className="min-h-screen font-WixMade bg-white p-6">
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
      {/* <div className="px-4 py-0 flex flex-col grow"> */}
            <div className="space-y-1 px-4 h-full flex-col flex overflow-hidden">
        <div className="px-2 py-4">
          <h1 className="text-lg font-semibold text-core">Subscription management</h1>
        </div>

        <div className="border-b border-gray-200 px-2">
          <div className="flex gap-8">
            <Link
              href={baseUrl}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap ${
                isActive('overview')
                  ? 'border-b-2 border-core text-core'
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              Overview
            </Link>
            <Link
              href={`${baseUrl}/plans`}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap ${
                isActive('plans')
                  ? 'border-b-2 border-core text-core'
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              Subscription
            </Link>
            <Link
              href={`${baseUrl}/usage`}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap ${
                isActive('usage')
                  ? 'border-b-2 border-core text-core'
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              Usage &amp; Limits
            </Link>
            <Link
              href={`${baseUrl}/history`}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap ${
                isActive('history')
                  ? 'border-b-2 border-core text-core'
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              History
            </Link>
            <Link
              href={`${baseUrl}/billing`}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap ${
                isActive('billing')
                  ? 'border-b-2 border-core text-core'
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              Billing
            </Link>
          </div>
        </div>

        <div className="grow overflow-y-auto p-1 mt-4 md:pb-3">{children}</div>
      </div>
    </ReusableCompanySidebar>
  )
}
