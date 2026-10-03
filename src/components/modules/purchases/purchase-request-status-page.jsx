const STATUS_COPY = {
  draft: 'Requests that have been started but are not yet submitted for approval.',
  'pending-approval': 'Requests submitted for review and waiting for an approval decision.',
  approved: 'Requests approved for purchasing and ready to be converted into purchase orders.',
  rejected: 'Requests reviewed and declined. They can be revised and submitted again.',
  converted: 'Approved requests that have already been converted into purchase orders.',
}

export default function PurchaseRequestStatusPage({ status }) {
  const label = status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  return <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">{STATUS_COPY[status] || `Purchase requests with status ${label.toLowerCase()}.`}</div>
}