import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Overdue Bills"
      description="Review overdue supplier bills for this branch."
      status="overdue"
    />
  )
}
