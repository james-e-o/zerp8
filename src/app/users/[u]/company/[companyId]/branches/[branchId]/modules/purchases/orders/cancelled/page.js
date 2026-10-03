import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function CancelledOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Cancelled Purchase Orders"
      description="Review cancelled purchase orders for this branch."
      status="cancelled"
    />
  )
}
