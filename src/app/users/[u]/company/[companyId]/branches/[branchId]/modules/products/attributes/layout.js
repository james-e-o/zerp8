import PageHeader from "@/components/modules/sales/PageHeader"

export default function AttributesLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Attributes"
        description="Define the attributes used to describe products."
      />
      {children}
    </div>
  )
}
