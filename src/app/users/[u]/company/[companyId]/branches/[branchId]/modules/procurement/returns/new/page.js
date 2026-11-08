import { Suspense } from 'react'
import NewReturnPage from '@/components/modules/procurement/new-return-page'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewReturnPage />
    </Suspense>
  )
}
