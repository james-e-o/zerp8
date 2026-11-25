'use client'

// Order status pill + the three tags (Delivery / Invoicing / Payment). This is its own file so the shared
// quotation-shared.jsx is not touched. 'fulfilled' now reads "Delivered" (the system sets it when everything is
// delivered); "Completed" is the manual seal made by the Complete order button.
const STATUS = {
  draft: ['Draft', 'bg-muted text-muted-foreground'],
  open: ['Open', 'bg-blue-50 text-blue-700'],
  partially_fulfilled: ['Partially fulfilled', 'bg-amber-50 text-amber-700'],
  fulfilled: ['Delivered', 'bg-emerald-50 text-emerald-700'],
  completed: ['Completed', 'bg-slate-800 text-white'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
  cancelled_partial: ['Cancelled - Partially fulfilled', 'bg-red-50 text-red-700'],
}

const TAGS = {
  delivery: {
    not_delivered: ['Not delivered', 'bg-muted text-muted-foreground'],
    partly_delivered: ['Partly delivered', 'bg-amber-50 text-amber-700'],
    delivered: ['Delivered', 'bg-emerald-50 text-emerald-700'],
  },
  invoicing: {
    not_invoiced: ['Not invoiced', 'bg-muted text-muted-foreground'],
    partly_invoiced: ['Partly invoiced', 'bg-amber-50 text-amber-700'],
    invoiced: ['Invoiced', 'bg-emerald-50 text-emerald-700'],
  },
  payment: {
    no_invoice: ['No invoice', 'bg-muted text-muted-foreground'],
    unpaid: ['Unpaid', 'bg-red-50 text-red-700'],
    partly_paid: ['Partly paid', 'bg-amber-50 text-amber-700'],
    paid: ['Paid', 'bg-emerald-50 text-emerald-700'],
  },
}

function Pill({ label, style }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${style}`}>{label}</span>
}

export function OrderStatusBadge({ status }) {
  const [label, style] = STATUS[status] || [status || '—', 'bg-muted text-muted-foreground']
  return <Pill label={label} style={style} />
}

// tags = one row of sales_order_status_tags(); renders nothing for draft / cancelled orders (their tags are null).
export function OrderTags({ tags, showWarnings = true }) {
  if (!tags || !tags.delivery_tag) return null
  const pick = (kind, key) => TAGS[kind][key]
  const items = [
    ['Delivery', pick('delivery', tags.delivery_tag)],
    ['Invoicing', pick('invoicing', tags.invoicing_tag)],
    ['Payment', pick('payment', tags.payment_tag)],
  ]
  return (
    <span className="flex flex-wrap items-center gap-1">
      {items.map(([title, entry]) => (entry ? <span key={title} title={title}><Pill label={entry[0]} style={entry[1]} /></span> : null))}
      {showWarnings && tags.delivered_not_invoiced && <Pill label="Delivered, not invoiced" style="bg-orange-50 text-orange-700" />}
      {showWarnings && tags.invoiced_not_delivered && <Pill label="Invoiced, not delivered" style="bg-orange-50 text-orange-700" />}
    </span>
  )
}
