import BillsListPage from '@/components/modules/procurement/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Paid Bills"
      description="Review paid supplier bills for this branch."
      status="paid"
    />
  )
}
