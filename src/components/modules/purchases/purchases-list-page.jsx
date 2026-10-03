export default function PurchasesListPage({ title, description }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
      {description || `${title} records will appear here as purchase data is connected.`}
    </div>
  )
}
