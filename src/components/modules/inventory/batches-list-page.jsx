import { Badge } from "@/components/ui/badge";
import InventoryDataTable from "@/components/modules/inventory/inventory-data-table";
import { inventoryBatches } from "@/components/modules/inventory/inventory-demo-data";

const FILTERS = {
  expiring: "Expiring",
  expired: "Expired",
  blocked: "Blocked",
};

export default function BatchesListPage({ filter = "all" }) {
  const rows = inventoryBatches.filter((batch) => (
    filter === "all" || batch.status === FILTERS[filter]
  ));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sample inventory data · {rows.length} batch records.
      </p>
      <InventoryDataTable
        columns={[
          { key: "id", label: "Batch" },
          { key: "product", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "warehouse", label: "Warehouse" },
          { key: "quantity", label: "Quantity" },
          { key: "expires", label: "Expiry" },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <Badge variant="outline">{row.status}</Badge>
            ),
          },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyMessage="No batches match this filter."
      />
    </div>
  );
}
