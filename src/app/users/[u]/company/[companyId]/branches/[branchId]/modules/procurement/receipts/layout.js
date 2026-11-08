import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Purchases sees receipts but does not make them: inventory counts goods in
// (Inventory > Receipts). This section tracks what arrived against each order
// and holds the one decision that belongs to purchases, Excess.
const TABS = [
  { label: 'All', value: '' },
  { label: 'Quarantine', value: 'quarantine' },
  { label: 'Excess', value: 'excess' },
  { label: 'Unbilled', value: 'unbilled' },
  { label: 'Done', value: 'done' },
]

export default async function ReceiptsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Receipts"
        description="See what inventory has received against your orders."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
