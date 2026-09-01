// columns: [{ key: "id", label: "ID", align: "left" | "right" }]
// rows: array of objects; render is an optional map of key -> (value, row) => node
export default function DataTable({ columns, rows, render = {}, onRowClick }) {
  return (
    <div className="border border-line rounded-lg overflow-hidden bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-base/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-inkmute text-xs uppercase tracking-wide ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-inkmute text-sm">
                Nothing here yet.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line last:border-0 ${
                onRowClick ? "hover:bg-base cursor-pointer" : ""
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-ink ${col.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {render[col.key] ? render[col.key](row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
