import InventorySectionPage from "@/components/modules/inventory/inventory-section-page";

export default async function TransferDetailPage({ params }) {
  const { transferId } = await params;
  return <InventorySectionPage title={`Transfer · ${transferId}`} />;
}
