"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import {
  inventoryBatches,
  inventoryCounts,
  inventoryQuarantine,
  inventoryStock,
  inventoryTransfers,
} from "@/components/modules/inventory/inventory-demo-data";

function OverviewCard({ label, value, href }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </Link>
  );
}

function OverviewList({ title, href, linkLabel, rows, renderRow, emptyLabel }) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="text-xs font-medium text-core hover:underline">
          {linkLabel}
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map(renderRow)}
        </ul>
      ) : (
        <p className="px-4 py-5 text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  );
}

export default function InventoryPage() {
  const { u, companyId, branchId } = useParams();
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`;

  const lowStock = inventoryStock.filter((row) => {
    const available = row.onHand - row.reserved;
    return row.onHand > 0 && available <= row.reorder;
  });
  const expiringBatches = inventoryBatches.filter((batch) => batch.status === "Expiring");
  const inTransit = inventoryTransfers.filter((transfer) => transfer.status === "In Transit");
  const countsInProgress = inventoryCounts.filter((count) => count.status === "In Progress");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Inventory position and stock activity for this branch."
      />
      <p className="text-xs text-muted-foreground">
        Sample inventory data · replace the shared inventory data source with Supabase queries when ready.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewCard label="Low Stock" value={lowStock.length} href={`${basePath}/stock/low`} />
        <OverviewCard label="Quarantine" value={inventoryQuarantine.length} href={`${basePath}/stock/quarantine`} />
        <OverviewCard label="Expiring Batches" value={expiringBatches.length} href={`${basePath}/stock/batches/expiring`} />
        <OverviewCard label="In Transit" value={inTransit.length} href={`${basePath}/transfers/in-transit`} />
        <OverviewCard label="Counts in Progress" value={countsInProgress.length} href={`${basePath}/adjustments/counting`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewList
          title="Low Stock"
          href={`${basePath}/stock/low`}
          linkLabel="View stock"
          rows={lowStock}
          emptyLabel="No variants are currently below their reorder level."
          renderRow={(row) => (
            <li key={row.sku} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
              <div>
                <p className="font-medium">{row.product}</p>
                <p className="text-muted-foreground">{row.sku} · {row.warehouse}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {row.onHand - row.reserved} available
              </span>
            </li>
          )}
        />
        <OverviewList
          title="Quarantine"
          href={`${basePath}/stock/quarantine`}
          linkLabel="Review holds"
          rows={inventoryQuarantine}
          emptyLabel="There are no quarantined items."
          renderRow={(row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
              <div>
                <p className="font-medium">{row.product}</p>
                <p className="text-muted-foreground">{row.reason} · {row.warehouse}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">{row.quantity} held</span>
            </li>
          )}
        />
        <OverviewList
          title="Expiring Batches"
          href={`${basePath}/stock/batches/expiring`}
          linkLabel="View batches"
          rows={expiringBatches}
          emptyLabel="No batches are nearing expiry."
          renderRow={(batch) => (
            <li key={batch.id} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
              <div>
                <p className="font-medium">{batch.product}</p>
                <p className="text-muted-foreground">{batch.id} · {batch.warehouse}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">Expires {batch.expires}</span>
            </li>
          )}
        />
        <OverviewList
          title="Transfers in Transit"
          href={`${basePath}/transfers/in-transit`}
          linkLabel="View transfers"
          rows={inTransit}
          emptyLabel="No transfers are currently in transit."
          renderRow={(transfer) => (
            <li key={transfer.ref} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
              <div>
                <p className="font-medium">{transfer.ref}</p>
                <p className="text-muted-foreground">{transfer.from} → {transfer.to}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">{transfer.qty} units</span>
            </li>
          )}
        />
        <OverviewList
          title="Counts in Progress"
          href={`${basePath}/adjustments/counting`}
          linkLabel="View counts"
          rows={countsInProgress}
          emptyLabel="No stock counts are in progress."
          renderRow={(count) => (
            <li key={count.ref} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
              <div>
                <p className="font-medium">{count.ref}</p>
                <p className="text-muted-foreground">{count.warehouse} · {count.location}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">{count.products} products</span>
            </li>
          )}
        />
      </div>
    </div>
  );
}
