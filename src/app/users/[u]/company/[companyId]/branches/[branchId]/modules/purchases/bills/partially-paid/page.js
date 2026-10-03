import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Partially Paid Bills"
      description="Review partially paid supplier bills for this branch."
      status="partially-paid"
    />
  )
}
