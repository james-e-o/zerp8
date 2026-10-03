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
import { inventoryReservations } from "@/components/modules/inventory/inventory-demo-data";

export default function ReservedListPage({
  title,
  description,
  filter = "all",
}) {
  const rows = inventoryReservations.filter((row) => {
    if (filter === "by-order") return row.ref.startsWith("SO-");
    if (filter === "by-quotation") return row.ref.startsWith("QUO-");
    if (filter === "expiring-soon") return row.status === "Expiring Soon";
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
        Sample inventory data · {rows.length} reservation records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ref}>
                  <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>
                    <div>{row.product}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                  </TableCell>
                  <TableCell>{row.qty}</TableCell>
                  <TableCell>{row.warehouse}</TableCell>
                  <TableCell>{row.expires}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "Expiring Soon"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
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
