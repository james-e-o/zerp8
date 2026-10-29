// Inventory > Settings > Reservations & Picking.
// No settings yet: these rules need the sales and delivery pages that do not exist.

export default function ReservationsAndPickingSettingsPage() {
  return (
    <div className="max-w-2xl space-y-3">
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6">
        <h2 className="text-xs font-semibold text-gray-800">Reservations & Picking</h2>
        <p className="mt-2 text-xs text-gray-600">Nothing to set here yet. When stock is reserved (on a confirmed order or at picking), how long a reservation holds, and how pickers are told which batch to take all depend on sales orders and deliveries, which are not built. The settings will appear here when they are.</p>
      </div>
    </div>
  )
}
