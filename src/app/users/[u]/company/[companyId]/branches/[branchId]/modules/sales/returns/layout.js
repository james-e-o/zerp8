import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";
import Link from "next/link";

const TABS = [
  { label: "All", value: "all" },
  { label: "Requested", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Received", value: "received" },
];

export default async function ReturnsLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/returns`;
  return (
    <div>
      <PageHeader
        title="Returns"
        description="Goods returned by customers, and how each one resolves — restock, reject, or credit note."
        action={
          <Link href={`${basePath}/new`} className="px-4 py-2 rounded-md bg-core text-white text-sm font-medium hover:bg-core/80 transition-colors">
            New Return
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  );
}
