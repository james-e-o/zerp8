import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

export default function InventorySectionLayout({ basePath, title, description, tabs, children }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <TabNav tabs={tabs} basePath={basePath} />
      {children}
    </div>
  )
}
