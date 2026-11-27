import RfqForm from '@/components/modules/procurement/rfq-form'

export default async function EditRfqPage({ params }) {
  const { rfqId } = await params
  return <RfqForm rfqId={rfqId} />
}
