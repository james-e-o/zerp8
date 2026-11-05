'use client'

// Small pieces shared by the Sales delivery pages and Inventory > Outgoing,
// which work on the same delivery documents.

const STATUS_STYLES = {
  pending: ['Pending', 'bg-slate-100 text-slate-700'],
  picking: ['Picking', 'bg-amber-50 text-amber-700'],
  ready: ['Ready', 'bg-blue-50 text-blue-700'],
  delivered: ['Delivered', 'bg-emerald-50 text-emerald-700'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
}

export function DeliveryStatusPill({ status }) {
  const [label, style] = STATUS_STYLES[status] || [status || '—', 'bg-muted text-muted-foreground']
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${style}`}>{label}</span>
  )
}

// Where a delivery is opened from: Sales > Deliveries or Inventory > Outgoing.
export function deliveryBasePath({ u, companyId, branchId }, context) {
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules`
  return context === 'inventory' ? `${root}/inventory/outgoing` : `${root}/sales/deliveries`
}
