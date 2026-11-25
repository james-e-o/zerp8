import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function PosLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`
  const link = 'rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Point of Sale"
        description="Walk-in sales, paid in full at the till. Stock leaves the shelf the moment a sale is completed."
        action={
          <div className="flex gap-2">
          <Link href={basePath} > <Button className="h-6 hover:text-white py-1.5 text-xs px-3 rounded-md bg-core_light hover:bg-core" variant="outline">Sell</Button></Link>
          <Link href={`${basePath}/history`} > <Button className="h-6 hover:text-white py-1.5 text-xs px-3 rounded-md bg-core_light hover:bg-core" variant="outline">Sales history</Button></Link>
          <Link href={`${basePath}/sessions`} > <Button className="h-6 hover:text-white py-1.5 text-xs px-3 rounded-md bg-core_light hover:bg-core" variant="outline">Sessions</Button></Link>
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
