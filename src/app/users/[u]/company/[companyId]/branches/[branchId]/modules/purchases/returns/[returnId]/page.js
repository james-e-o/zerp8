export default async function PurchaseReturnDetailPage({ params }) {
  const { returnId } = await params

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-800">Return details</h2>
      <p className="text-xs text-gray-500">
        Return details for {returnId} will appear here.
      </p>
    </div>
  )
}
