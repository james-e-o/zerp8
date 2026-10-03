const STATUS_COPY = {
  draft: 'Orders that have been started but not yet submitted for approval.',
  'pending-approval': 'Orders submitted and waiting for an approval decision.',
  approved: 'Orders approved and awaiting goods receipt.',
  'partially-received': 'Orders where some, but not all, line items have been received.',
  'fully-received': 'Orders fully received. Ready to be billed.',
  cancelled: 'Orders that were cancelled before completion.',
}

export default function PurchaseOrderStatusPage({ status }) {
  const label = status
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
      {STATUS_COPY[status] || `Purchase orders with status ${label.toLowerCase()}.`}
    </div>
  )
}
