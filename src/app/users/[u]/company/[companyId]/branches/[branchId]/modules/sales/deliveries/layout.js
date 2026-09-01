import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

// Tabs split by fulfillment_type and by status — Delivery and Pickup are
// both just Delivery Note records (see lib/mock-data), filtered client-side.
const TABS = [
  { label: "All", value: "all" },
  { label: "Delivery", value: "delivery" },
  { label: "Pickup", value: "pickup" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default function DeliveriesLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Every Delivery Note — dispatched or collected in person — that moves stock out of a warehouse."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New delivery note
          </button>
        }
      />
      <TabNav tabs={TABS} basePath="/deliveries" />
      {children}
    </div>
  );
}
