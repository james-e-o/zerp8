import PageHeader from "@/components/modules/sales/PageHeader"

export default function ProductsSettingsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure product behavior for this branch."
      />
      {children}
    </div>
  )
}
