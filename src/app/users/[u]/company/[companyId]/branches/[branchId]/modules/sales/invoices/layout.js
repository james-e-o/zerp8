import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import InvoiceDocTabs from '@/components/modules/sales/invoice-doc-tabs'

// Invoices is three kinds of billing document. Each has its own status tabs (in its own layout).
//   Sales invoices  the real bill, raised on a sales order, in whole or in parts
//   Proforma        an offer of what can be supplied now; converts into an order + sales invoice
//   Credit notes    created from sales returns (a credit note always points at an invoice)
const DOC_TABS = [
  { label: 'Sales invoices', value: 'sales-invoices' },
  { label: 'Proforma', value: 'proforma-invoices' },
  { label: 'Credit notes', value: 'credit-notes' },
]

export default async function InvoicesLayout({ children, params }) {
  const { u, companyId, branchId } = await params
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Invoices"
        description="Sales invoices, proforma invoices and credit notes, and the payments received against them."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/proforma-invoices/new`}
              className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              New proforma
            </Link>
            <Link
              href={`${basePath}/sales-invoices/new`}
              className="rounded-md bg-core px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-core/90"
            >
              New sales invoice
            </Link>
          </div>
        }
      />
      <InvoiceDocTabs basePath={basePath} tabs={DOC_TABS} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
