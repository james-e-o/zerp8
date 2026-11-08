import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Requested', value: 'requested' },
  { label: 'Approved', value: 'approved' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default async function ReturnsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/returns`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Returns"
        description="Goods customers send back from delivered orders. Credit notes and refunds follow from here."
        action={
          <Link
            href={`${basePath}/new`}
            className="rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
          >
            New return
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}
