import CustomerFormPage from '@/components/modules/sales/customer-form-page'

export default async function Page({ params }) {
  const { customerId } = await params
  return <CustomerFormPage customerId={customerId} />
}
