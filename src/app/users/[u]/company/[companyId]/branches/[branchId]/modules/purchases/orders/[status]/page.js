import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default async function OrderStatusPage({ params }) {
  const { status } = await params
  const title = status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <PurchaseOrdersListPage
      title={`${title} Purchase Orders`}
      description={`Review ${title.toLowerCase()} purchase orders for this branch.`}
      status={status}
    />
  )
}
