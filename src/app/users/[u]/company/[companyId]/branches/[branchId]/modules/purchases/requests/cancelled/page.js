import PurchaseRequestsListPage from '@/components/modules/purchases/purchase-requests-list-page'

export default function CancelledRequestsPage() {
  return (
    <PurchaseRequestsListPage
      title="Cancelled Purchase Requests"
      description="Review cancelled purchase requests for this branch."
      status="cancelled"
    />
  )
}
