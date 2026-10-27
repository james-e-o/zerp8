import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Outgoing is everything that physically leaves the branch. Sales and POS only
// create the commercial documents and reserve stock; inventory picks, hands
// over and confirms. Pending is the landing tab (what has to go out).
const TABS = [
  { label: 'Pending', value: '' },
  { label: 'Picking', value: 'picking' },
  { label: 'Ready', value: 'ready' },
  { label: 'Returns', value: 'returns' },
  { label: 'Done', value: 'done' },
  { label: 'POS', value: 'pos' },
]

export default async function OutgoingLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/outgoing`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Outgoing"
        description="Pick, hand over and confirm everything that leaves the branch."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
