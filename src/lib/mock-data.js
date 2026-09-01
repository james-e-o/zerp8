// Placeholder data standing in for API/DB calls. Shape mirrors the
// documents discussed for NexShelf-8's Sales module.

export const naira = (n) =>
  "₦" + Number(n).toLocaleString("en-NG", { maximumFractionDigits: 0 });

export const quotations = [
  { id: "QT-0045", customer: "ABC Merchandise Ltd", items: "100 × Product A", total: 500000, status: "Accepted", date: "2026-08-02" },
  { id: "QT-0046", customer: "Femi Adeyemi", items: "12 × Product C", total: 84000, status: "Sent", date: "2026-08-11" },
  { id: "QT-0047", customer: "Greenfield Stores", items: "40 × Product B", total: 220000, status: "Draft", date: "2026-08-19" },
  { id: "QT-0048", customer: "XYZ Distributors", items: "300 × Product A", total: 1500000, status: "Expired", date: "2026-07-14" },
  { id: "QT-0049", customer: "Chika Okonkwo", items: "5 × Product D", total: 32500, status: "Rejected", date: "2026-08-05" },
];

export const orders = [
  { id: "SO-0124", customer: "ABC Merchandise Ltd", ordered: 100, delivered: 60, total: 500000, terms: "30 days", status: "Partially Fulfilled" },
  { id: "SO-0125", customer: "Femi Adeyemi", ordered: 12, delivered: 12, total: 84000, terms: "Cash", status: "Fulfilled" },
  { id: "SO-0126", customer: "XYZ Distributors", ordered: 300, delivered: 0, total: 1500000, terms: "45 days", status: "Confirmed" },
  { id: "SO-0127", customer: "Greenfield Stores", ordered: 40, delivered: 40, total: 220000, terms: "Cash", status: "Closed" },
  { id: "SO-0128", customer: "Mike Balogun", ordered: 20, delivered: 0, total: 96000, terms: "Cash", status: "Cancelled" },
];

export const deliveries = [
  { id: "DN-0010-1", so: "SO-0124", customer: "ABC Merchandise Ltd", type: "Delivery", qty: 60, warehouse: "WH-01", date: "2026-08-10", status: "Completed" },
  { id: "DN-0010-2", so: "SO-0124", customer: "ABC Merchandise Ltd", type: "Delivery", qty: 40, warehouse: "WH-01", date: "—", status: "Pending" },
  { id: "DN-0011", so: "SO-0125", customer: "Femi Adeyemi", type: "Pickup", qty: 12, warehouse: "WH-01", date: "2026-08-11", status: "Completed" },
  { id: "DN-0012", so: "SO-0127", customer: "Greenfield Stores", type: "Pickup", qty: 40, warehouse: "WH-02", date: "2026-08-01", status: "Completed" },
];

export const invoices = [
  { id: "INV-0125", type: "Sales Invoice", customer: "ABC Merchandise Ltd", total: 500000, paid: 200000, balance: 300000, status: "Partially Paid", due: "2026-09-01" },
  { id: "INV-0126", type: "Sales Invoice", customer: "Femi Adeyemi", total: 84000, paid: 84000, balance: 0, status: "Paid", due: "2026-08-11" },
  { id: "PI-0034", type: "Proforma Invoice", customer: "XYZ Distributors", total: 1500000, paid: 0, balance: 1500000, status: "Unpaid", due: "—" },
  { id: "INV-0127", type: "Sales Invoice", customer: "Mike Balogun", total: 250000, paid: 0, balance: 250000, status: "Overdue", due: "2026-08-15" },
  { id: "CN-0030", type: "Credit Note", customer: "Greenfield Stores", total: -50000, paid: 0, balance: -50000, status: "Applied", due: "—" },
];

export const returns = [
  { id: "RET-0005", so: "SO-0124", customer: "ABC Merchandise Ltd", items: "10 × Product A", reason: "Damaged", resolution: "Credit Note", status: "Approved", date: "2026-08-20" },
  { id: "RET-0006", so: "SO-0127", customer: "Greenfield Stores", items: "3 × Product B", reason: "Wrong item", resolution: "Restocked", status: "Requested", date: "2026-08-27" },
];

export const customers = [
  { id: "CUST-001", name: "ABC Merchandise Ltd", type: "B2B", balance: 300000, orders: 14, phone: "080X XXX XXXX" },
  { id: "CUST-002", name: "Femi Adeyemi", type: "Retail", balance: 0, orders: 3, phone: "070X XXX XXXX" },
  { id: "CUST-003", name: "XYZ Distributors", type: "B2B", balance: 1500000, orders: 22, phone: "081X XXX XXXX" },
  { id: "CUST-004", name: "Greenfield Stores", type: "B2B", balance: -50000, orders: 9, phone: "090X XXX XXXX" },
];
