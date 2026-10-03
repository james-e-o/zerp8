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
import { inventoryTransfers } from "@/components/modules/inventory/inventory-demo-data";

const STATUS_LABELS = {
  "in-transit": "In Transit",
};

export default function TransfersListPage({
  title,
  description,
  filter = "all",
}) {
  const status = STATUS_LABELS[filter] || filter;
  const rows = inventoryTransfers.filter(
    (row) => filter === "all" || row.status === status,
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
        Sample inventory data · {rows.length} transfer records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
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
                  <TableCell>{row.from}</TableCell>
                  <TableCell>{row.to}</TableCell>
                  <TableCell>{row.items}</TableCell>
                  <TableCell>{row.qty}</TableCell>
                  <TableCell>{row.eta}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "Completed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : row.status === "Cancelled"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : row.status === "Pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
