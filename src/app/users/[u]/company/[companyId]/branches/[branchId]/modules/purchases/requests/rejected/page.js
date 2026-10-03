import PurchaseRequestsListPage from '@/components/modules/purchases/purchase-requests-list-page'

export default function RejectedRequestsPage() {
  return <PurchaseRequestsListPage 
    title="Rejected Purchase Requests" 
    description="Review rejected purchase requests for this branch." 
    status="rejected" 
/>
}