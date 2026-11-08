import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Saved', value: 'saved' },
  { label: 'Sent', value: 'sent' },
  { label: 'Converted', value: 'converted' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function Layout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/proforma-invoices`

  return (
    <>
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </>
  )
}
