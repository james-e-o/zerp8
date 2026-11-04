import { Suspense } from 'react'
import NewReturnPage from '@/components/modules/purchases/new-return-page'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewReturnPage />
    </Suspense>
  )
}
