import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'To review', value: '' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Not yet billed', value: 'not-yet-billed' },
  { label: 'Sold before billing', value: 'sold-before-billing' },
]

export default async function BillDifferencesLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/bill-differences`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Bill differences"
        description="Where a supplier bill differs from the cost stock was received at."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
