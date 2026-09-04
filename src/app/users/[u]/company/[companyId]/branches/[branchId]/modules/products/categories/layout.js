import PageHeader from "@/components/modules/sales/PageHeader"

export default function CategoriesLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products into categories."
      />
      {children}
    </div>
  )
}
