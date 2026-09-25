"use client";

import { useParams, usePathname } from "next/navigation";
import ReturnsList from "@/components/modules/sales/returns-list";
import { DUMMY_RETURNS } from "@/components/modules/sales/dummy-data";

const TITLES = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
};

export default function ReturnsListPage() {
  const { u, companyId, branchId } = useParams();
  const pathname = usePathname();
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`;
  const status = pathname.endsWith("/returns") ? "all" : pathname.split("/").pop();
  const returns = status === "all" ? DUMMY_RETURNS : DUMMY_RETURNS.filter((ret) => ret.status === status);

  return <ReturnsList base={base} returns={returns} title={TITLES[status] || "All Returns"} />;
}
