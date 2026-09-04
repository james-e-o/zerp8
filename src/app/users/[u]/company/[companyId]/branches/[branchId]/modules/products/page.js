import PageHeader from "@/components/modules/sales/PageHeader"

export default function ProductsOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Product activity and performance for this branch."
      />

      <div className="p-4">
        <h1 className="text-2xl font-bold">Products Overview</h1>
      </div>
    </div>
  )
}