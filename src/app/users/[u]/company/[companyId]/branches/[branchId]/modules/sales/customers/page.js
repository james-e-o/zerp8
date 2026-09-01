import PageHeader from "@/components/modules/sales/PageHeader";
import DataTable from "@/components/modules/sales/DataTable";
import { naira, customers } from "@/lib/mock-data";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers"
        description="Profiles, contacts, and running balances for every customer on this branch."
        action={
          <button className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-ink transition-colors">
            New customer
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "name", label: "Customer" },
          { key: "type", label: "Type" },
          { key: "phone", label: "Phone" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "balance", label: "Balance", align: "right" },
        ]}
        rows={customers}
        render={{
          balance: (v) => (
            <span className={v > 0 ? "text-warn" : v < 0 ? "text-ok" : "text-inkmute"}>
              {v === 0 ? "—" : naira(Math.abs(v)) + (v < 0 ? " credit" : " owed")}
            </span>
          ),
        }}
      />
    </div>
  );
}
