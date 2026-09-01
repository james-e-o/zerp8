"use client";

import { useSearchParams } from "next/navigation";
import DataTable from "@/components/modules/sales/DataTable";
import StatusBadge from "@/components/modules/sales/StatusBadge";
import { naira, quotations } from "@/lib/mock-data";

export default function QuotationsPage() {
  const status = useSearchParams().get("status") || "all";
  const rows =
    status === "all"
      ? quotations
      : quotations.filter((q) => q.status.toLowerCase() === status);

  return (
    <DataTable
      columns={[
        { key: "id", label: "Quotation" },
        { key: "customer", label: "Customer" },
        { key: "items", label: "Items" },
        { key: "total", label: "Total", align: "right" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      render={{
        total: (v) => naira(v),
        status: (v) => <StatusBadge status={v} />,
      }}
    />
  );
}
