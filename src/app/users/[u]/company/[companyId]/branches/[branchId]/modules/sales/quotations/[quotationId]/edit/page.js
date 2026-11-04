import QuotationFormPage from '@/components/modules/sales/quotation-form-page'

export default async function Page({ params }) {
  const { quotationId } = await params
  return <QuotationFormPage quotationId={quotationId} />
}
