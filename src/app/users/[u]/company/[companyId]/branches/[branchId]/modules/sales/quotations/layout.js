import PageHeader from "@/components/modules/sales/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";

const TABS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

// PageHeader + status tabs live here in the layout because they're shared
// chrome across every filtered view of the quotations list. page.js below
// only owns the part that actually changes: the filtered table.
export default function QuotationsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Price offers sent to customers before they commit to an order."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New quotation
          </button>
        }
      />
      <TabNav tabs={TABS} basePath="/quotations" />
      {children}
    </div>
  );
}
