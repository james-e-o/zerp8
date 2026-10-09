import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function SentOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Sent Purchase Orders"
      description="Review purchase orders sent to suppliers for this branch."
      status="sent"
    />
  )
}