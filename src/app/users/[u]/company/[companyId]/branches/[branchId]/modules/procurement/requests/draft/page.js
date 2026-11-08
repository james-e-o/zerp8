import PurchaseRequestsListPage from '@/components/modules/procurement/purchase-requests-list-page'

export default function DraftRequestsPage() {
  return <PurchaseRequestsListPage 
        title="Draft Purchase Requests" 
        description="Review draft purchase requests for this branch." 
        status="draft" 
    />
}