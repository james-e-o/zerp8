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
import { inventoryAdjustments } from "@/components/modules/inventory/inventory-demo-data";

export default function AdjustmentsListPage({
  title,
  description,
  filter = "all",
}) {
  const rows = inventoryAdjustments.filter(
    (row) => filter === "all" || row.status.toLowerCase() === filter,
  );

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
        Sample inventory data · {rows.length} adjustment records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ref}>
                  <TableCell>
                    <div className="font-mono text-xs">{row.ref}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.date}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.product}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                  </TableCell>
                  <TableCell
                    className={
                      row.qty < 0
                        ? "font-semibold text-red-700"
                        : "font-semibold text-emerald-700"
                    }
                  >
                    {row.qty > 0 ? "+" : ""}
                    {row.qty}
                  </TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>{row.warehouse}</TableCell>
                  <TableCell>{row.by}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "Posted"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
