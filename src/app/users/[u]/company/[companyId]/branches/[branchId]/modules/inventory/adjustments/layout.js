import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Adjustments: counts and direct changes to stock. Counting is work in
// progress, Pending is waiting for approval, Posted has changed stock.
const TABS = [
  { label: 'All', value: '' },
  { label: 'Counting', value: 'counting' },
  { label: 'Pending', value: 'pending' },
  { label: 'Posted', value: 'posted' },
]

export default async function AdjustmentsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/adjustments`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Adjustments"
        description="Count stock and correct it. Differences are posted only after approval, where approval is on."
        action={
          <Link
            href={`${basePath}/new`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New adjustment
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
