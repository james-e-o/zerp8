import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'All', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Out', value: 'out' },
  { label: 'Reserved', value: 'reserved' },
  { label: 'Quarantine', value: 'quarantine' },
  { label: 'Batches', value: 'batches' },
  { label: 'Valuation', value: 'valuation' },
]

export default async function StockLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/stock`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Stock" description="View current inventory levels across the branch." />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
