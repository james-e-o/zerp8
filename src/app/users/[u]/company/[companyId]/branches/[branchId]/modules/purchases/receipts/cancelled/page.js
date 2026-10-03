import ReceiptsListPage from '@/components/modules/purchases/receipts-list-page'

export default function ReceiptsStatusPage() {
  return (
    <ReceiptsListPage
      title="Cancelled Receipts"
      description="Review cancelled receipts for this branch."
      status="cancelled"
    />
  )
}
