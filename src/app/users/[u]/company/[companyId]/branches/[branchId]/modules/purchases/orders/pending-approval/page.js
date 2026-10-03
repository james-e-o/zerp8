import PurchaseOrdersListPage from '@/components/modules/purchases/purchase-orders-list-page'

export default function PendingApprovalOrdersPage() {
  return (
    <PurchaseOrdersListPage
      title="Pending Approval Purchase Orders"
      description="Review purchase orders awaiting approval for this branch."
      status="pending-approval"
    />
  )
}
