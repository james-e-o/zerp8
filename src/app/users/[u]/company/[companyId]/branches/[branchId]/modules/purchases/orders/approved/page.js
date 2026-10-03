import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function ApprovedOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Approved Purchase Orders"
      description="Review approved purchase orders for this branch."
      status="approved"
    />
  )
}
