import PurchasesListPage from '@/components/modules/purchases/purchases-list-page'

export default async function ReturnStatusPage({ params }) {
  const { status } = await params
  const title = status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  return <PurchasesListPage title={`${title} Returns`} description={`Review ${title.toLowerCase()} returns for this branch.`} />
}
