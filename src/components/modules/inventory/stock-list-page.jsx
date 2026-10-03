import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryStock } from "@/components/modules/inventory/inventory-demo-data";

export default function StockListPage({ title, description, filter = "all" }) {
  const rows = inventoryStock.filter((row) => {
    const available = row.onHand - row.reserved;
    if (filter === "low") return row.onHand > 0 && available <= row.reorder;
    if (filter === "out") return row.onHand === 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && (
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Sample inventory data · {rows.length} stock records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU / Variant</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const available = row.onHand - row.reserved;
                const status =
                  row.onHand === 0
                    ? "Out of Stock"
                    : available <= row.reorder
                      ? "Low Stock"
                      : "Healthy";
                const statusClass =
                  status === "Out of Stock"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : status === "Low Stock"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";

                return (
                  <TableRow key={row.sku}>
                    <TableCell>
                      <div className="font-medium">{row.product}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.category} · {row.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{row.sku}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.variant}
                      </div>
                    </TableCell>
                    <TableCell>{row.warehouse}</TableCell>
                    <TableCell>{row.onHand.toLocaleString()}</TableCell>
                    <TableCell>{row.reserved.toLocaleString()}</TableCell>
                    <TableCell>{available.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass}>
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
