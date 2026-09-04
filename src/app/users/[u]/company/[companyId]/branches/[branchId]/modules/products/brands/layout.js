import PageHeader from "@/components/modules/sales/PageHeader"

export default function BrandsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage the brands assigned to products."
      />
      {children}
    </div>
  )
}
