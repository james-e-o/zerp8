import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Products > Settings. Add a tab here when a new settings page is added.
const TABS = [
  { label: 'Pricing', value: 'pricing' },
]

export default async function ProductsSettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/settings`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Settings"
        description="Company-wide rules for products, costs and selling prices."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto p-0.5">{children}</div>
    </div>
  )
}