// Temporary in-memory dummy data for the Sales module.
// Replace with real API/DB calls once the backend is wired up.

export const DUMMY_CUSTOMERS = [
  {
    id: "cust_001",
    name: "ABC Ltd",
    email: "accounts@abcltd.com",
    phone: "+234 801 234 5678",
    address: "12 Marina Road, Lagos",
    creditLimit: 5000000,
    paymentTerms: "Net 30",
    outstandingBalance: 900000,
  },
  {
    id: "cust_002",
    name: "Delta Foods",
    email: "procurement@deltafoods.ng",
    phone: "+234 802 345 6789",
    address: "4 Allen Avenue, Ikeja",
    creditLimit: 2000000,
    paymentTerms: "Net 15",
    outstandingBalance: 0,
  },
  {
    id: "cust_003",
    name: "Greenfield Traders",
    email: "info@greenfieldtraders.com",
    phone: "+234 803 456 7890",
    address: "9 Awolowo Way, Ikeja",
    creditLimit: 1000000,
    paymentTerms: "Due on receipt",
    outstandingBalance: 250000,
  },
]

export const DUMMY_PRODUCTS = [
  { id: "prod_A", name: "Product A", unitPrice: 10000, stock: 340 },
  { id: "prod_B", name: "Product B", unitPrice: 4500, stock: 120 },
  { id: "prod_C", name: "Product C", unitPrice: 22000, stock: 58 },
]

export const DUMMY_QUOTATIONS = [
  {
    id: "QT-001",
    customerId: "cust_001",
    customerName: "ABC Ltd",
    status: "accepted",
    validUntil: "2026-10-15",
    createdAt: "2026-09-01",
    items: [{ productId: "prod_A", name: "Product A", qty: 100, unitPrice: 10000 }],
    total: 1000000,
  },
  {
    id: "QT-002",
    customerId: "cust_003",
    customerName: "Greenfield Traders",
    status: "sent",
    validUntil: "2026-10-05",
    createdAt: "2026-09-10",
    items: [{ productId: "prod_B", name: "Product B", qty: 50, unitPrice: 4500 }],
    total: 225000,
  },
  {
    id: "QT-003",
    customerId: "cust_002",
    customerName: "Delta Foods",
    status: "draft",
    validUntil: "2026-10-20",
    createdAt: "2026-09-18",
    items: [{ productId: "prod_C", name: "Product C", qty: 10, unitPrice: 22000 }],
    total: 220000,
  },
]

export const DUMMY_ORDERS = [
  {
    id: "SO-001",
    customerId: "cust_001",
    customerName: "ABC Ltd",
    quotationId: "QT-001",
    status: "partially_fulfilled",
    createdAt: "2026-09-02",
    items: [{ productId: "prod_A", name: "Product A", ordered: 100, delivered: 60, unitPrice: 10000 }],
  },
  {
    id: "SO-002",
    customerId: "cust_003",
    customerName: "Greenfield Traders",
    quotationId: null,
    status: "open",
    createdAt: "2026-09-15",
    items: [{ productId: "prod_B", name: "Product B", ordered: 50, delivered: 0, unitPrice: 4500 }],
  },
]

export const DUMMY_DELIVERIES = [
  {
    id: "DN-001",
    orderId: "SO-001",
    customerName: "ABC Ltd",
    fulfillmentType: "delivery",
    status: "delivered",
    deliveredAt: "2026-09-05",
    items: [{ productId: "prod_A", name: "Product A", qty: 60 }],
  },
]

export const DUMMY_INVOICES = [
  {
    id: "INV-001",
    type: "sales_invoice",
    orderId: "SO-001",
    deliveryId: "DN-001",
    customerId: "cust_001",
    customerName: "ABC Ltd",
    status: "partially_paid",
    issuedAt: "2026-09-06",
    dueDate: "2026-10-06",
    items: [{ productId: "prod_A", name: "Product A", qty: 60, unitPrice: 10000 }],
    total: 600000,
    paid: 300000,
    payments: [{ id: "PAY-001", amount: 300000, method: "Bank Transfer", reference: "TRX-1001", date: "2026-09-10" }],
  },
  {
    id: "PI-001",
    type: "proforma",
    orderId: "SO-002",
    deliveryId: null,
    customerId: "cust_003",
    customerName: "Greenfield Traders",
    status: "unpaid",
    issuedAt: "2026-09-16",
    dueDate: "2026-09-30",
    items: [{ productId: "prod_B", name: "Product B", qty: 50, unitPrice: 4500 }],
    total: 225000,
    paid: 0,
    payments: [],
  },
]

export const DUMMY_RETURNS = [
  {
    id: "RET-001",
    deliveryId: "DN-001",
    invoiceId: "INV-001",
    customerName: "ABC Ltd",
    status: "received",
    source: "manual",
    resolution: "restock",
    createdAt: "2026-09-12",
    items: [{ productId: "prod_A", name: "Product A", deliveredQty: 60, returnedQty: 10, restockable: true }],
    creditNoteId: null,
  },
]

export const DUMMY_POS_SALES = [
  {
    id: "POS-0001",
    createdAt: "2026-09-18T10:22:00",
    items: [{ productId: "prod_A", name: "Product A", qty: 2, unitPrice: 10000 }],
    total: 20000,
    paymentMethod: "Cash",
    status: "completed",
  },
  {
    id: "POS-0002",
    createdAt: "2026-09-19T14:05:00",
    items: [{ productId: "prod_C", name: "Product C", qty: 1, unitPrice: 22000 }],
    total: 22000,
    paymentMethod: "Card",
    status: "completed",
  },
]

export const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-blue-100 text-blue-700",
  partially_fulfilled: "bg-amber-100 text-amber-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  delivered: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-red-100 text-red-700",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  requested: "bg-gray-100 text-gray-600",
  approved: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  proforma: "bg-indigo-100 text-indigo-700",
  sales_invoice: "bg-blue-100 text-blue-700",
  credit_note: "bg-purple-100 text-purple-700",
}

export function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString()}`
}

export function formatStatusLabel(status) {
  return String(status).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}