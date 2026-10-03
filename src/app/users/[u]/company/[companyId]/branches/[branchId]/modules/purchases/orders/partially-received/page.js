import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function PartiallyReceivedOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Partially Received Purchase Orders"
      description="Review purchase orders with partial receipts for this branch."
      status="partially-received"
    />
  )
}
