import PurchasesSectionLayout from '@/components/modules/purchases/purchases-section-layout'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function ReturnsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/returns`
  return <PurchasesSectionLayout basePath={basePath} title="Returns" description="Manage goods returned to suppliers." tabs={TABS}>{children}</PurchasesSectionLayout>
}
