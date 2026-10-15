import PageHeader from '@/components/PageHeader'
import TabNav from '@/components/modules/sales/TabNav'

// Replaces the per-folder layout.js approach from the last batch
// entirely - matches the real pattern already used for Returns,
// Orders and Requests: ONE layout.js at the settings/ root using
// PageHeader + the shared TabNav, not six duplicated back-link
// layouts. Delete the layout.js files from the previous batch (and
// the general/ folder isn't needed at all anymore - see the note on
// the General tab's value below).
//
// Goes at modules/purchases/settings/layout.js.
//
// TABS: 'General' uses value 'all', matching how the Sales settings
// example you pasted handled its own first tab - the assumption
// (not confirmed against TabNav's actual source, which I don't have)
// is that TabNav routes a tab to `${basePath}` itself when value is
// 'all', and to `${basePath}/${value}` otherwise. That's why there's
// no settings/general/ folder in this batch - General's content is
// settings/page.js itself, at the root. If TabNav actually builds
// hrefs differently (e.g. `${basePath}/all`), General's content just
// needs to move into a settings/all/page.js folder instead - nothing
// else here changes.

const TABS = [
  { label: 'General', value: 'all' },
  { label: 'Purchase Orders', value: 'purchase-orders' },
  { label: 'Requests & Approvals', value: 'requests-approvals' },
  { label: 'Receiving Rules', value: 'receiving-rules' },
  { label: 'Supplier Bills', value: 'supplier-bills' },
  { label: 'Purchase Returns', value: 'purchase-returns' },
]

export default async function PurchasesSettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/settings`

  return (
    <div>
      <PageHeader
        title="Purchases Settings"
        description="Configuration that governs purchase requests, orders, receiving, bills, and returns."
        navigation={<TabNav tabs={TABS} basePath={basePath} />}
      />
      {children}
    </div>
  )
}