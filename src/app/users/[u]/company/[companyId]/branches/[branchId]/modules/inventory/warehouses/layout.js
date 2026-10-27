import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

// Same structure as Receipts: one layout at the root of the sub-route. The
// header and the All / Active / Archived tabs stay above every page under
// Warehouses, including New warehouse and a single warehouse.

const TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
]

export default async function WarehousesLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/warehouses`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Warehouses"
        description="Manage inventory locations assigned to this branch."
        action={
          <Link
            href={`${basePath}/new`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New warehouse
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
