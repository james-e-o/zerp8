import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Partially Received', value: 'partially-received' },
  { label: 'Fully Received', value: 'fully-received' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function OrdersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Purchase Orders"
        description="Track supplier orders from draft through receipt."
        action={
          <Link
            href={`${basePath}/new`}
            className="rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New order
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}
