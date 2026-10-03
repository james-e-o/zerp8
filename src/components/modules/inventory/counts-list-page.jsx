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
import { inventoryCounts } from "@/components/modules/inventory/inventory-demo-data";

const STATUS_LABELS = {
  "in-progress": "In Progress",
};

export default function CountsListPage({ title, description, filter = "all" }) {
  const status = STATUS_LABELS[filter] || filter;
  const rows = inventoryCounts.filter(
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
        Sample inventory data · {rows.length} count records.
      </p>
      <Card className="rounded-lg shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Count</TableHead>
                <TableHead>Warehouse / Location</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Counted</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ref}>
                  <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                  <TableCell>
                    <div>{row.warehouse}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.location}
                    </div>
                  </TableCell>
                  <TableCell>{row.products}</TableCell>
                  <TableCell>{row.expected.toLocaleString()}</TableCell>
                  <TableCell>
                    {row.counted == null ? "—" : row.counted.toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={
                      row.variance < 0
                        ? "font-semibold text-red-700"
                        : row.variance > 0
                          ? "font-semibold text-emerald-700"
                          : ""
                    }
                  >
                    {row.variance == null
                      ? "—"
                      : `${row.variance > 0 ? "+" : ""}${row.variance}`}
                  </TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "Completed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : row.status === "Scheduled"
                            ? "border-border bg-muted text-muted-foreground"
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
