import { redirect } from 'next/navigation'

// Settings has no page of its own yet: open the first tab.
export default async function ProductsSettingsPage({ params }) {
  const { u, companyId, branchId } = await params
  redirect(`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/settings/pricing`)
}