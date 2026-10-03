import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function OrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="All Purchase Orders"
      description="Review all purchase orders for this branch."
      status="all"
    />
  )
}
