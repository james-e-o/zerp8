import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Transit', value: 'in-transit', path: 'in-transit' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function TransfersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/transfers`
  return <InventorySectionLayout basePath={basePath} title="Transfers" description="Move inventory between warehouses and locations." tabs={TABS}>{children}</InventorySectionLayout>
}
