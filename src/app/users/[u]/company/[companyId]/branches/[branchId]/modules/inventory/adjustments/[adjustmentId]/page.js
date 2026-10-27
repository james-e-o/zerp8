import InventorySectionPage from "@/components/modules/inventory/inventory-section-page";

export default async function AdjustmentDetailPage({ params }) {
  const { adjustmentId } = await params;
  return <InventorySectionPage title={`Adjustment · ${adjustmentId}`} />;
}
