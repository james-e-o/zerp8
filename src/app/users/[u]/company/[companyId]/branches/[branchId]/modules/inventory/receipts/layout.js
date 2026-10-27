import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Receipts is where everything that comes into the branch is counted in:
// purchase orders, gifts, opening stock and anything else. All is the landing
// tab (every receipt); Expected lists the orders still due.
const TABS = [
  { label: 'All', value: '' },
  { label: 'Expected', value: 'expected' },
  { label: 'Drafts', value: 'drafts' },
  { label: 'Quarantine', value: 'quarantine' },
  { label: 'Excess', value: 'excess' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Unbilled', value: 'unbilled' },
  { label: 'Done', value: 'done' },
]

export default async function ReceiptsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/receipts`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Receipts"
        description="Count in everything that arrives, and check it before it becomes stock."
        action={
          <Link
            href={`${basePath}/new`}
            className="h-7 rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New receipt
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}