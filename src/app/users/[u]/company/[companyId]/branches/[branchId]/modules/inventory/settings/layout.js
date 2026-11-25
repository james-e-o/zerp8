import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// General is the settings root (settings/page.js), so its tab value is ''.
// Every other tab has its own folder and page.js.
const TABS = [
  { label: 'General', value: '' },
  { label: 'Receiving', value: 'receiving' },
  { label: 'Costing', value: 'costing' },
  { label: 'Batch & Expiry', value: 'batches-and-expiry' },
  { label: 'Adjustments & Write-offs', value: 'adjustments-and-write-offs' },
  { label: 'Transfers', value: 'transfers' },
]

export default async function InventorySettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/settings`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Inventory Settings"
        description="Configure inventory behavior for this branch."
      />
      <TabNav tabs={TABS} basePath={basePath} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}