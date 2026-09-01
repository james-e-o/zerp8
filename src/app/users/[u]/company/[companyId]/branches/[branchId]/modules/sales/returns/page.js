"use client";

import { useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { returns } from "@/lib/mock-data";

export default function ReturnsPage() {
  const status = useSearchParams().get("status") || "all";
  const rows =
    status === "all" ? returns : returns.filter((r) => r.status.toLowerCase() === status);

  return (
    <DataTable
      columns={[
        { key: "id", label: "Return" },
        { key: "so", label: "Sales Order" },
        { key: "customer", label: "Customer" },
        { key: "items", label: "Items" },
        { key: "reason", label: "Reason" },
        { key: "resolution", label: "Resolution" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      render={{
        status: (v) => <StatusBadge status={v} />,
      }}
    />
  );
}
