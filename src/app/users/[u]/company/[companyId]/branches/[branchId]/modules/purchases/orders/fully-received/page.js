import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function FullyReceivedOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Fully Received Purchase Orders"
      description="Review purchase orders fully received for this branch."
      status="fully-received"
    />
  )
}
