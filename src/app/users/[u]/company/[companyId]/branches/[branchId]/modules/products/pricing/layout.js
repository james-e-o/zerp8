import PageHeader from "@/components/modules/sales/PageHeader"
import PricingTabNav from "./pricing-tab-nav"

export default async function PricingLayout({ params, children }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/pricing`

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Manage product pricing, contexts, and promotions."
      />

      <PricingTabNav basePath={basePath} />

      <div>
        {children}
      </div>
    </div>
  )
}
