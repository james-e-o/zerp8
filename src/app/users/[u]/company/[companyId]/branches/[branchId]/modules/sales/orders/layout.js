import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
  { label: 'Partially fulfilled', value: 'partially-fulfilled' },
  { label: 'Delivered', value: 'fulfilled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function OrdersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Sales Orders"
        description="Confirmed customer orders. Prices lock while a pro forma or invoice exists for them. Complete an order to seal it."
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
