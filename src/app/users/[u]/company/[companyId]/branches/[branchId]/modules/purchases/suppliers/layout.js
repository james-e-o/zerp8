import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export default async function SuppliersLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers`
  return <div><PageHeader title="Suppliers" description="Profiles, balances and purchasing history." action={<Link href={`${basePath}/new`} className="rounded-md bg-core px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-core/90">New supplier</Link>} />{children}</div>
}
