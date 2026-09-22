import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";
import Link from "next/link";

// Tabs split by fulfillment_type and by status — Delivery and Pickup are
// both just Delivery Note records (see lib/mock-data), filtered client-side.
const TABS = [
  { label: "All", value: "all" },
  { label: "Delivery", value: "delivery" },
  { label: "Pickup", value: "pickup" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default async function DeliveriesLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/deliveries`;
  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Every Delivery Note — dispatched or collected in person — that moves stock out of a warehouse."
        action={
          <Link href={`${basePath}/new`} className="px-4 py-2 rounded-md bg-core text-white text-sm font-medium hover:bg-core/90 transition-colors">
            New delivery note
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  );
}
