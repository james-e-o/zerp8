import PageHeader from "@/components/modules/sales/PageHeader"

export default function CreateProductLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Create Product"
        description="Add a new product to this branch."
      />
      {children}
    </div>
  )
}
