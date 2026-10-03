import PurchaseRequestsListPage from '@/components/modules/purchases/purchase-requests-list-page'

export default function PendingApprovalRequestsPage() {
  return <PurchaseRequestsListPage 
        title="Pending Approval Purchase Requests" 
        description="Review purchase requests awaiting approval for this branch." 
        status="pending-approval"
    />
}