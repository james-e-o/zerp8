import SupplierForm from '@/components/modules/purchases/supplier-form'

export default async function EditSupplierPage({ params }) {
  const { supplierId } = await params
  return <SupplierForm supplierId={supplierId} />
}
