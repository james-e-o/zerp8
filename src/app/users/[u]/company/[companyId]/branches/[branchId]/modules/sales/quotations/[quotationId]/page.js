import QuotationDetailPage from '@/components/modules/sales/quotation-detail-page'

export default async function Page({ params }) {
  const { quotationId } = await params
  return <QuotationDetailPage quotationId={quotationId} />
}
