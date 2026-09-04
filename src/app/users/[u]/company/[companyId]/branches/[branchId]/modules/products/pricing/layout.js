import Link from "next/link"
import PageHeader from "@/components/modules/sales/PageHeader"

export default async function PricingLayout({ params, children }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/pricing`

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Manage product pricing, contexts, and promotions."
      />

      <nav className="flex gap-6 border-b border-border" aria-label="Pricing navigation">
        <Link href={`${basePath}/contexts`} className="border-b-2 border-core px-1 pb-2 text-sm font-medium text-core">
          Pricing Contexts
        </Link>
        <Link href={`${basePath}/promotions`} className="px-1 pb-2 text-sm text-muted-foreground hover:text-foreground">
          Promotions
        </Link>
        <Link href={`${basePath}/settings`} className="px-1 pb-2 text-sm text-muted-foreground hover:text-foreground">
          Settings
        </Link>
      </nav>

      <div>
        {children}
      </div>
    </div>
  )
}
