import PurchaseRequestsListPage from '@/components/modules/procurement/purchase-requests-list-page'

export default function ConvertedRequestsPage() {
    return <PurchaseRequestsListPage 
        title="Converted Purchase Requests" 
        description="Review purchase requests converted into purchase orders for this branch." 
        status="converted" 
    />
}