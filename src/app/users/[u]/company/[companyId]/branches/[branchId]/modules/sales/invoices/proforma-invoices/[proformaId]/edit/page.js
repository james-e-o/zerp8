import { Suspense } from 'react'
import ProformaForm from '@/components/modules/sales/proforma-form'

export default async function Page({ params }) {
  const { proformaId } = await params
  return (
    <Suspense fallback={<p className="p-4 text-xs text-muted-foreground">Opening proforma...</p>}>
      <ProformaForm proformaId={proformaId} />
    </Suspense>
  )
}
