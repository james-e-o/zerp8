import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'General', value: '' },
  { label: 'Documents', value: 'documents' },
]

export default async function SalesSettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/settings`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Sales Settings"
        description="Defaults and printed details for this branch's sales documents."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  )
}
