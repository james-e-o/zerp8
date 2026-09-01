import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

const TABS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Partially Fulfilled", value: "partially fulfilled" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Closed", value: "closed" },
];

export default function OrdersLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="What the customer committed to — independent of whether it's been delivered yet."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New sales order
          </button>
        }
      />
      <TabNav tabs={TABS} basePath="/orders" />
      {children}
    </div>
  );
}
