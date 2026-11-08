import PurchaseOrdersListPage from '@/components/modules/procurement/purchase-orders-list-page'

export default function DraftOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Draft Purchase Orders"
      description="Review draft purchase orders for this branch."
      status="draft"
    />
  )
}
