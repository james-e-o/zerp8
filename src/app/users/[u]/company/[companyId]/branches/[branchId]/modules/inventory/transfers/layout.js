import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Transfers: stock moving from one warehouse to another, inside a branch or
// into another branch. Every transfer goes: approval (where on) -> in transit
// -> accepted by the receiving warehouse. Incoming is what is on its way to
// this branch.
const TABS = [
  { label: 'All', value: '' },
  { label: 'Drafts', value: 'drafts' },
  { label: 'Awaiting approval', value: 'pending' },
  { label: 'In transit', value: 'in-transit' },
  { label: 'Incoming', value: 'incoming' },
  { label: 'Received', value: 'received' },
]

export default async function TransfersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/transfers`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Transfers"
        description="Move stock between warehouses. It leaves when sent and enters the other warehouse only when that warehouse accepts it."
        action={
          <Link
            href={`${basePath}/new`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New transfer
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
