import { Suspense } from 'react'
import ProformaForm from '@/components/modules/sales/proforma-form'

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-xs text-muted-foreground">Loading proforma...</p>}>
      <ProformaForm />
    </Suspense>
  )
}
