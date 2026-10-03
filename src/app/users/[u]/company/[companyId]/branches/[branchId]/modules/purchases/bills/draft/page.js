import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default function BillsStatusPage() {
  return (
    <BillsListPage
      title="Draft Bills"
      description="Review draft supplier bills for this branch."
      status="draft"
    />
  )
}
