import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/modules/sales/TabNav";

const TABS = [
  { label: "General", value: "all" },
  { label: "Receiving", value: "receiving" },
  { label: "Costing", value: "costing" },
  { label: "Batch & Expiry", value: "batches-and-expiry" },
  { label: "Reservations & Picking", value: "reservations-and-picking" },
  { label: "Adjustments & Write-offs", value: "adjustments-and-write-offs" },
  { label: "Transfers", value: "transfers" },
  { label: "Warehouses", value: "warehouses" },
];

export default async function SettingsLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/settings`;
  return (
    <div>
      <PageHeader
        title="Inventory Settings"
        description="Configure inventory behavior for this branch."
        navigation={<TabNav tabs={TABS} basePath={basePath} />}
      />
      {children}
    </div>
  );
}
