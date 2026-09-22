import PageHeader from "@/components/PageHeader"

export default function AllProductsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="All Products"
        description="View and manage every product in this branch."
      />
      {children}
    </div>
  )
}
