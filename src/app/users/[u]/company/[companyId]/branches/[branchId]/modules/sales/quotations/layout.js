import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";
import Link from "next/link";

const TABS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

// The status navigation is shared across quotation list pages. Each list page
// owns its own heading so the title stays with the page content.
export default async function QuotationsLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`;

  return (
    <div className="flex overflow-hidden h-full flex-col">
      <PageHeader
        title="Quotations"
        description="Price offers sent to customers before they commit to an order."
        action={
          <Link href={`${basePath}/new`} className="px-4 py-2 rounded-md bg-core text-white text-sm font-medium hover:bg-core/80 transition-colors">
            New Quotation
          </Link>
        }
      />
      <TabNav tabs={TABS} basePath={basePath} />
      {children}
    </div>
  );
}
