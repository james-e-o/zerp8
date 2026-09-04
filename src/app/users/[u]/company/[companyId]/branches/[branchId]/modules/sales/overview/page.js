import PageHeader from "@/components/modules/sales/PageHeader";
import StatCard from "@/components/modules/sales/StatCard";
import DataTable from "@/components/modules/sales/DataTable";
import StatusBadge from "@/components/modules/sales/StatusBadge";
import { naira, orders, invoices } from "@/lib/mock-data";

export default function OverviewPage() {
  const outstanding = invoices
    .filter((i) => i.balance > 0)
    .reduce((sum, i) => sum + i.balance, 0);

  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Revenue, orders, and outstanding invoices across this branch."
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue this month" value={naira(2304000)} sub="+12% vs last month" tone="ok" />
        <StatCard label="Open orders" value="18" sub="6 partially fulfilled" />
        <StatCard label="Outstanding invoices" value={naira(outstanding)} sub="4 invoices unpaid" tone="warn" />
        <StatCard label="Returns this month" value="2" sub="1 pending review" tone="bad" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-ink">Recent orders</h2>
        <a href="/orders" className="text-sm text-brand hover:underline">View all orders</a>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "ordered", label: "Ordered", align: "right" },
          { key: "delivered", label: "Delivered", align: "right" },
          { key: "total", label: "Total", align: "right" },
          { key: "status", label: "Status" },
        ]}
        rows={recentOrders}
        render={{
          total: (v) => naira(v),
          status: (v) => <StatusBadge status={v} />,
        }}
      />
    </div>
  );
}
