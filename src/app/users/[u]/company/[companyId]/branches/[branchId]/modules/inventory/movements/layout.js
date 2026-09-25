import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Inbound', value: 'inbound' },
  { label: 'Outbound', value: 'outbound' },
]

export default async function MovementsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/movements`
  return <InventorySectionLayout basePath={basePath} title="Movements" description="Track stock moving into and out of the branch." tabs={TABS}>{children}</InventorySectionLayout>
}
