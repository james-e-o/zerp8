"use client";

import { useSearchParams } from "next/navigation";
import DataTable from "@/components/modules/sales/DataTable";
import StatusBadge from "@/components/modules/sales/StatusBadge";
import { naira, orders } from "@/lib/mock-data";

export default function OrdersPage() {
  const status = useSearchParams().get("status") || "all";
  const rows =
    status === "all"
      ? orders
      : orders.filter((o) => o.status.toLowerCase() === status);

  return (
    <DataTable
      columns={[
        { key: "id", label: "Order" },
        { key: "customer", label: "Customer" },
        { key: "fulfillment", label: "Fulfillment" },
        { key: "terms", label: "Terms" },
        { key: "total", label: "Total", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      render={{
        fulfillment: (_, row) => (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${(row.delivered / row.ordered) * 100}%` }}
              />
            </div>
            <span className="text-xs text-inkmute tabular-nums whitespace-nowrap">
              {row.delivered}/{row.ordered}
            </span>
          </div>
        ),
        total: (v) => naira(v),
        status: (v) => <StatusBadge status={v} />,
      }}
    />
  );
}
