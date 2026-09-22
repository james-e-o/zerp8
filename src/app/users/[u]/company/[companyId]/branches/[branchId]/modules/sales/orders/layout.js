import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";
import Link from "next/link";

const TABS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Partially Fulfilled", value: "partially_fulfilled" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
];

export default async function OrdersLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`;
  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="What the customer committed to — independent of whether it's been delivered yet."
        action={
          <Link href={`${basePath}/new`} className="px-4 py-2 rounded-md bg-core text-white text-sm font-medium hover:bg-core/90 transition-colors">
            New sales order
          </Link>
        }
        navigation={<TabNav tabs={TABS} basePath={basePath} />}
      />
      {children}
    </div>
  );
}
