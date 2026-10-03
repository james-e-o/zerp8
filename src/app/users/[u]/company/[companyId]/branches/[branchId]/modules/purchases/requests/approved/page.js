import PurchaseRequestsListPage from '@/components/modules/purchases/purchase-requests-list-page'

export default function ApprovedRequestsPage() {
  return <PurchaseRequestsListPage 
        title="Approved Purchase Requests" 
        description="Review approved purchase requests for this branch." 
        status="approved" 
    />
}