import BillsListPage from '@/components/modules/procurement/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Cancelled Bills"
      description="Review cancelled supplier bills for this branch."
      status="cancelled"
    />
  )
}
