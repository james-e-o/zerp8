import ReceiptsListPage from '@/components/modules/purchases/receipts-list-page'

export default async function ReceiptStatusPage({ params }) {
  const { status } = await params
  const title = status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <ReceiptsListPage
      title={`${title} Receipts`}
      description={`Review ${title.toLowerCase()} receipts for this branch.`}
      status={status}
    />
  )
}
