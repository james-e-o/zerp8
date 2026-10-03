import ReceiptsListPage from '@/components/modules/purchases/receipts-list-page'

export default function ReceiptsStatusPage() {
  return (
    <ReceiptsListPage
      title="Draft Receipts"
      description="Review draft receipts for this branch."
      status="draft"
    />
  )
}
