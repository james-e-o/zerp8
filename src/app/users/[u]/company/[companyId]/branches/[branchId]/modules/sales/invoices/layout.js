import PageHeader from "@/components/modules/sales/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";

// Sales Invoices, Proforma Invoices, and Credit Notes all live under one
// list — they're variants of the same billing concern, not separate
// sidebar modules (see the earlier discussion on why Credit Sales isn't
// a distinct document type either).
const TABS = [
  { label: "All", value: "all" },
  { label: "Sales Invoices", value: "sales invoice" },
  { label: "Proforma Invoices", value: "proforma invoice" },
  { label: "Credit Notes", value: "credit note" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partially Paid", value: "partially paid" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

export default function InvoicesLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Sales Invoices, Proforma Invoices, and Credit Notes — billing and payment state in one place."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New invoice
          </button>
        }
      />
      <TabNav tabs={TABS} basePath="/invoices" />
      {children}
    </div>
  );
}
