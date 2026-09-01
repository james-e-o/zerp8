// Customers doesn't have status-based sub-views the way Orders/Invoices
// do — a customer isn't "Draft" or "Paid". Its natural sub-navigation
// happens one level deeper, inside an individual customer's profile
// (Profile / Transactions / Ledger), not at the list level, so that
// tab set belongs in app/(sales)/customers/[id]/layout.js rather than here.
export default function CustomersLayout({ children }) {
  return <>{children}</>;
}
