import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Transit', value: 'in-transit', path: 'in-transit' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function TransfersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/transfers`
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Transfers"
        description="Move inventory between warehouses and locations."
        action={
          <Link
            href={`${basePath}/new`}
            className="rounded-md bg-core px-4 py-1.5 h-7 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New transfer
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}
