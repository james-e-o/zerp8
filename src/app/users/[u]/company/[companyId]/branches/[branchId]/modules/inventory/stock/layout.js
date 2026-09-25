import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Low Stock', value: 'low-stock', path: 'low-stock' },
  { label: 'Out of Stock', value: 'out-of-stock', path: 'out-of-stock' },
]

export default async function StockLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/stock`
  return <InventorySectionLayout basePath={basePath} title="Stock" description="View current inventory levels across the branch." tabs={TABS}>{children}</InventorySectionLayout>
}
