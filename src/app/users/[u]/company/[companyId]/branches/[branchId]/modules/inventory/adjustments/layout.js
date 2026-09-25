import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Posted', value: 'posted' },
]

export default async function AdjustmentsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/adjustments`
  return <InventorySectionLayout basePath={basePath} title="Adjustments" description="Review and post changes to inventory quantities." tabs={TABS}>{children}</InventorySectionLayout>
}
