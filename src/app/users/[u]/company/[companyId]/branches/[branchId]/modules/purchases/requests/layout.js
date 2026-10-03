import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Approval', value: 'pending-approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Converted', value: 'converted' },
]

export default async function RequestsLayout({ children, params }) {
  const { u, companyId, branchId } = await params

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Purchase Requests"
        description="Track internal requests through approval and conversion."
        action={
          <Link
            href={`${basePath}/new`}
            className="rounded-md bg-core px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New request
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}