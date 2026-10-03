import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

export default function PurchasesSectionLayout({ basePath, title, description, tabs, action, children }) {
  return (
    <div>
      <PageHeader title={title} description={description} action={action} />
      <TabNav tabs={tabs} basePath={basePath} />
      {children}
    </div>
  )
}
