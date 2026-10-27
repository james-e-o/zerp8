import Link from 'next/link'
import TabNav from '@/components/modules/sales/TabNav'

// One warehouse: Overview, Shelves, Stock. This sits under the Warehouses
// layout, which already shows the page header, so it adds only a way back
// and its own tabs. The warehouse's name and code are on the Overview tab.

const TABS = [
  { label: 'Overview', value: '' },
  { label: 'Shelves', value: 'shelves' },
  { label: 'Stock', value: 'stock' },
]

export default async function WarehouseDetailLayout({ children, params }) {
  const { u, companyId, branchId, warehouseId } = await params
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/warehouses`

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-3">
        <Link href={root} className="text-xs text-gray-600 hover:underline">
          &larr; All warehouses
        </Link>
      </div>
      <TabNav tabs={TABS} basePath={`${root}/${warehouseId}`} />
      {children}
    </div>
  )
}
