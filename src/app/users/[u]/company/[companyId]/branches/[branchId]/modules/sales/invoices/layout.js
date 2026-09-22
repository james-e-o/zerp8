import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";
import Link from "next/link";

// Sales Invoices, Proforma Invoices, and Credit Notes all live under one
// list — they're variants of the same billing concern, not separate
// sidebar modules (see the earlier discussion on why Credit Sales isn't
// a distinct document type either).
const TABS = [
  { label: "All", value: "all" },
  { label: "Sales Invoices", value: "sales_invoice" },
  { label: "Proforma Invoices", value: "proforma" },
  { label: "Credit Notes", value: "credit_note" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partially Paid", value: "partially paid" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

export default async function InvoicesLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Sales Invoices, Proforma Invoices, and Credit Notes — billing and payment state in one place."
        // action={
        //   <Link href={`${basePath}/new`} className="px-4 py-2 rounded-md bg-core text-white text-sm font-medium hover:bg-core/90 transition-colors">
        //     New invoice
        //   </Link>
        // }
        navigation={<TabNav tabs={TABS} basePath={basePath} />}
      />
      {children}
    </div>
  );
}
