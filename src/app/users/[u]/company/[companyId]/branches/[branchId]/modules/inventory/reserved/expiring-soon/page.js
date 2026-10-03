import ReservedListPage from "@/components/modules/inventory/reserved-list-page";

export default function ExpiringSoonPage() {
  return (
    <ReservedListPage
      title="Reservations Expiring Soon"
      filter="expiring-soon"
    />
  );
}
