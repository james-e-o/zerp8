import { Suspense } from 'react'
import SalesInvoiceForm from '@/components/modules/sales/sales-invoice-form'

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-xs text-muted-foreground">Loading invoice...</p>}>
      <SalesInvoiceForm />
    </Suspense>
  )
}
