import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Unpaid Bills"
      description="Review unpaid supplier bills for this branch."
      status="unpaid"
    />
  )
}
