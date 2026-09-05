import { redirect } from "next/navigation"

export default async function PricingPage({ params }) {
  const { u, companyId, branchId } = await params

  redirect(`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/pricing/contexts`)
}
