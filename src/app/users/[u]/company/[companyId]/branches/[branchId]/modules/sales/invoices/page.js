"use client";

import { useSearchParams } from "next/navigation";
import DataTable from "@/components/modules/sales/DataTable";
import StatusBadge from "@/components/modules/sales/StatusBadge";
import { naira, invoices } from "@/lib/mock-data";

export default function InvoicesPage() {
  const filter = useSearchParams().get("status") || "all";
  const rows =
    filter === "all"
      ? invoices
      : invoices.filter(
          (i) => i.type.toLowerCase() === filter || i.status.toLowerCase() === filter
        );

  return (
    <DataTable
      columns={[
        { key: "id", label: "Document" },
        { key: "type", label: "Type" },
        { key: "customer", label: "Customer" },
        { key: "total", label: "Total", align: "right" },
        { key: "paid", label: "Paid", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "due", label: "Due" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      render={{
        type: (v) => <span className="text-xs text-inkmute">{v}</span>,
        total: (v) => naira(v),
        paid: (v) => naira(v),
        balance: (v) => (
          <span className={v > 0 ? "text-warn font-medium" : v < 0 ? "text-ok font-medium" : "text-inkmute"}>
            {naira(v)}
          </span>
        ),
        status: (v) => <StatusBadge status={v} />,
      }}
    />
  );
}
