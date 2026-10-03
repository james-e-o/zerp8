import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

const TABS = [
  { label: 'General', value: 'all' },
  { label: 'Document Numbering', value: 'numbering' },
  { label: 'Taxes', value: 'taxes' },
  { label: 'Payment Terms', value: 'terms' },
]

export default async function SettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/settings`
  return <div><PageHeader title="Purchases Settings" description="Configuration that governs purchase orders, receipts, bills, and returns." navigation={<TabNav tabs={TABS} basePath={basePath} />} />{children}</div>
}
