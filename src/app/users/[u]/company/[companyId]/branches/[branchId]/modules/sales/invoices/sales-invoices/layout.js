import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Partially paid', value: 'partially-paid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function Layout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/sales-invoices`

  return (
    <>
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </>
  )
}
