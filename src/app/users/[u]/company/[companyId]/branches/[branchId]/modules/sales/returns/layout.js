import PageHeader from "@/components/modules/sales/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";

const TABS = [
  { label: "All", value: "all" },
  { label: "Requested", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

export default function ReturnsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Returns"
        description="Goods returned by customers, and how each one resolves — restock, reject, or credit note."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New return
          </button>
        }
      />
      <TabNav tabs={TABS} basePath="/returns" />
      {children}
    </div>
  );
}
