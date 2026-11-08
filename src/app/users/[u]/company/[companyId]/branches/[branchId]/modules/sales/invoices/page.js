import { redirect } from 'next/navigation'

export default async function Page({ params }) {
  const { u, companyId, branchId } = await params
  redirect(`/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/sales-invoices`)
}
