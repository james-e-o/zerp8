"use client";

import { useSearchParams } from "next/navigation";
import DataTable from "@/components/modules/sales/DataTable";
import StatusBadge from "@/components/modules/sales/StatusBadge";
import { Truck, HandPlatter } from "lucide-react";
import { deliveries } from "@/lib/mock-data";

export default function DeliveriesPage() {
  const filter = useSearchParams().get("status") || "all";
  const rows =
    filter === "all"
      ? deliveries
      : deliveries.filter(
          (d) => d.type.toLowerCase() === filter || d.status.toLowerCase() === filter
        );

  return (
    <DataTable
      columns={[
        { key: "id", label: "Delivery Note" },
        { key: "so", label: "Sales Order" },
        { key: "customer", label: "Customer" },
        { key: "type", label: "Fulfillment" },
        { key: "qty", label: "Qty", align: "right" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      render={{
        type: (v) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink">
            {v === "Pickup" ? <HandPlatter size={14} className="text-inkmute" /> : <Truck size={14} className="text-inkmute" />}
            {v}
          </span>
        ),
        status: (v) => <StatusBadge status={v} />,
      }}
    />
  );
}
