import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Counting', value: 'counting' },
  { label: 'Pending', value: 'pending' },
  { label: 'Posted', value: 'posted' },
];

export default async function AdjustmentsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/adjustments`
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Adjustments"
        description="Review and post changes to inventory quantities."
        action={
          <Link
            href={`${basePath}/new`}
            className="rounded-md bg-core px-4 py-1.5 h-7 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New adjustment
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}
