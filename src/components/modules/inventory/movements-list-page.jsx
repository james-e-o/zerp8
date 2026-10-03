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
import { inventoryMovements } from "@/components/modules/inventory/inventory-demo-data";

export default function MovementsListPage({
  title,
  description,
  filter = "all",
}) {
  const rows = inventoryMovements.filter(
    (row) => filter === "all" || row.type.toLowerCase() === filter,
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
        Sample inventory data · {rows.length} movement records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ref}>
                  <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.product}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.type === "Inbound"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }
                    >
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={
                      row.qty > 0
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {row.qty > 0 ? "+" : ""}
                    {row.qty}
                  </TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{row.warehouse}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.date}
                  </TableCell>
                  <TableCell>{row.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
