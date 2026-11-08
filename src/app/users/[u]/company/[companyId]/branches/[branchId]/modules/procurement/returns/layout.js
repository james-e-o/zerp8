import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'
import Link from 'next/link'

// Same shape as before, with one new tab. "To return" is purchases' list of
// damaged goods that arrived with a delivery: raise a return for them, or say
// they will not be sent back (then inventory writes them off). A return ends
// at Dispatched: inventory confirms the handover in Inventory > Outgoing >
// Returns. What the supplier does about it - credit note, refund,
// replacement - is the return's outcome, not a status.
const TABS = [
  { label: 'All', value: '' },
  { label: 'To return', value: 'to-return' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function ReturnsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/returns`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Returns"
        description="Manage goods returned to suppliers."
        action={
          <Link
            href={`${basePath}/new`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New return
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
