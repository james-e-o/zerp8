import InventorySectionLayout from '@/components/modules/inventory/inventory-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'By Order', value: 'by-order', path: 'by-order' },
  { label: 'By Quotation', value: 'by-quotation', path: 'by-quotation' },
  { label: 'Expiring Soon', value: 'expiring-soon', path: 'expiring-soon' },
]

export default async function ReservedLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/reserved`
  return <InventorySectionLayout basePath={basePath} title="Reserved" description="Review stock reserved by orders and quotations." tabs={TABS}>{children}</InventorySectionLayout>
}
