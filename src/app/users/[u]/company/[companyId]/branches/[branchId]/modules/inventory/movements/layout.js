import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Movements is read-only: it shows the permanent stock record. Nothing here
// can be edited; corrections are made through Adjustments, Transfers or
// Returns, which add new rows.

const TABS = [
  { label: 'All', value: '' },
  { label: 'Inbound', value: 'inbound' },
  { label: 'Outbound', value: 'outbound' },
  { label: 'Internal', value: 'internal' },
]

export default async function MovementsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/movements`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Movements" description="Track stock moving into and out of the branch." />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
