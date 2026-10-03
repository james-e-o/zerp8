import BillsListPage from '@/components/modules/purchases/bills-list-page'

export default async function BillStatusPage({ params }) {
  const { status } = await params
  const title = status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <BillsListPage
      title={`${title} Bills`}
      description={`Review ${title.toLowerCase()} bills for this branch.`}
      status={status}
    />
  )
}
