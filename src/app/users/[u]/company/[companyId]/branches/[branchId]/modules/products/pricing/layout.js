import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Pricing contexts is the route root (pricing/page.js), so its tab value is ''.
const TABS = [
  { label: 'Pricing contexts', value: '' },
  { label: 'Cost estimates', value: 'cost-estimates' },
  { label: 'Suggested prices', value: 'suggested-prices' },
  { label: 'Price changes', value: 'price-changes' },
]

export default async function PricingLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/pricing`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Pricing"
        description="Manage pricing contexts, cost estimates and selling-price changes."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto p-0.5">{children}</div>
    </div>
  )
}