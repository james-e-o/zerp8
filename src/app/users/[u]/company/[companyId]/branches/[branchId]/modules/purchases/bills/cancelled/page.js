import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Cancelled Bills"
      description="Review cancelled supplier bills for this branch."
      status="cancelled"
    />
  )
}
