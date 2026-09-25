import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in-progress', path: 'in-progress' },
  { label: 'Completed', value: 'completed' },
]

export default async function CountsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/counts`
  return <InventorySectionLayout basePath={basePath} title="Counts" description="Plan and reconcile physical inventory counts." tabs={TABS}>{children}</InventorySectionLayout>
}
