import PageHeader from "@/components/PageHeader"

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
