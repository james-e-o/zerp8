import ReceiptsListPage from '@/components/modules/purchases/receipts-list-page'

export default function ReceiptsStatusPage() {
  return (
    <ReceiptsListPage
      title="Posted Receipts"
      description="Review posted receipts for this branch."
      status="posted"
    />
  )
}
