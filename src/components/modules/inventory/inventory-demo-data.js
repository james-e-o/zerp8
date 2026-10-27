// Static sample records for Inventory route UI until persistence is connected.
export const inventoryStock = [
  { sku: 'SKU-1001', product: 'Premium Office Chair', variant: 'Black / Standard', category: 'Furniture', warehouse: 'Lagos Main Warehouse', location: 'A-01-04', onHand: 148, reserved: 36, reorder: 50, value: 592000 },
  { sku: 'SKU-1002', product: 'Executive Desk', variant: 'Walnut / 1.6m', category: 'Furniture', warehouse: 'Lagos Main Warehouse', location: 'A-02-01', onHand: 24, reserved: 8, reorder: 20, value: 840000 },
  { sku: 'SKU-1003', product: 'Wireless Keyboard', variant: 'Black / US Layout', category: 'Electronics', warehouse: 'Lagos Main Warehouse', location: 'B-04-02', onHand: 86, reserved: 14, reorder: 30, value: 774000 },
  { sku: 'SKU-1004', product: 'USB-C Hub', variant: '7-in-1', category: 'Electronics', warehouse: 'Lagos Main Warehouse', location: 'B-04-06', onHand: 17, reserved: 6, reorder: 25, value: 255000 },
  { sku: 'SKU-1005', product: 'Thermal Receipt Roll', variant: '80mm x 80mm', category: 'Consumables', warehouse: 'Lagos Main Warehouse', location: 'C-02-03', onHand: 0, reserved: 0, reorder: 50, value: 0 },
  { sku: 'SKU-1006', product: 'Barcode Scanner', variant: '2D Wireless', category: 'Electronics', warehouse: 'Abuja Fulfillment Warehouse', location: 'A-03-02', onHand: 31, reserved: 9, reorder: 15, value: 620000 },
  { sku: 'SKU-1007', product: 'Packing Tape', variant: '48mm x 50m', category: 'Packaging', warehouse: 'Abuja Fulfillment Warehouse', location: 'C-01-01', onHand: 9, reserved: 2, reorder: 20, value: 45000 },
]

export const inventoryMovements = [
  { ref: 'DEL-261003-0142', date: '03 Oct 2026, 09:42', product: 'Premium Office Chair', sku: 'SKU-1001', type: 'Outbound', qty: -12, source: 'Sales Delivery', warehouse: 'Lagos Main Warehouse', user: 'A. Ibrahim' },
  { ref: 'GRN-261003-0088', date: '03 Oct 2026, 08:55', product: 'Wireless Keyboard', sku: 'SKU-1003', type: 'Inbound', qty: 40, source: 'Purchase Receipt', warehouse: 'Lagos Main Warehouse', user: 'J. Okafor' },
  { ref: 'TRF-261002-0041', date: '02 Oct 2026, 17:20', product: 'Barcode Scanner', sku: 'SKU-1006', type: 'Inbound', qty: 8, source: 'Transfer', warehouse: 'Abuja Fulfillment Warehouse', user: 'M. Yusuf' },
  { ref: 'ADJ-261002-0019', date: '02 Oct 2026, 15:06', product: 'USB-C Hub', sku: 'SKU-1004', type: 'Outbound', qty: -3, source: 'Adjustment', warehouse: 'Lagos Main Warehouse', user: 'T. Bello' },
  { ref: 'RET-261002-0026', date: '02 Oct 2026, 12:41', product: 'Executive Desk', sku: 'SKU-1002', type: 'Inbound', qty: 1, source: 'Customer Return', warehouse: 'Lagos Main Warehouse', user: 'A. Ibrahim' },
  { ref: 'TRF-261001-0038', date: '01 Oct 2026, 16:18', product: 'Packing Tape', sku: 'SKU-1007', type: 'Outbound', qty: -10, source: 'Transfer', warehouse: 'Abuja Fulfillment Warehouse', user: 'M. Yusuf' },
]

export const inventoryAdjustments = [
  { ref: 'ADJ-261002-0019', date: '02 Oct 2026', product: 'USB-C Hub', sku: 'SKU-1004', qty: -3, reason: 'Damaged', warehouse: 'Lagos Main Warehouse', status: 'Posted', by: 'T. Bello' },
  { ref: 'ADJ-261001-0017', date: '01 Oct 2026', product: 'Packing Tape', sku: 'SKU-1007', qty: -4, reason: 'Stock Count', warehouse: 'Abuja Fulfillment Warehouse', status: 'Pending', by: 'M. Yusuf' },
  { ref: 'ADJ-260930-0013', date: '30 Sep 2026', product: 'Wireless Keyboard', sku: 'SKU-1003', qty: 2, reason: 'Data Correction', warehouse: 'Lagos Main Warehouse', status: 'Posted', by: 'J. Okafor' },
  { ref: 'ADJ-260929-0011', date: '29 Sep 2026', product: 'Premium Office Chair', sku: 'SKU-1001', qty: -1, reason: 'Damaged', warehouse: 'Lagos Main Warehouse', status: 'Posted', by: 'A. Ibrahim' },
]

export const inventoryTransfers = [
  { ref: 'TRF-261002-0041', date: '02 Oct 2026', from: 'Lagos Main Warehouse', to: 'Abuja Fulfillment Warehouse', items: 4, qty: 42, eta: '04 Oct 2026', status: 'In Transit', owner: 'M. Yusuf' },
  { ref: 'TRF-261001-0038', date: '01 Oct 2026', from: 'Lagos Main Warehouse', to: 'Abuja Fulfillment Warehouse', items: 2, qty: 30, eta: '03 Oct 2026', status: 'Completed', owner: 'M. Yusuf' },
  { ref: 'TRF-260930-0034', date: '30 Sep 2026', from: 'Abuja Fulfillment Warehouse', to: 'Lagos Main Warehouse', items: 3, qty: 18, eta: '05 Oct 2026', status: 'Pending', owner: 'A. Ibrahim' },
  { ref: 'TRF-260928-0029', date: '28 Sep 2026', from: 'Lagos Main Warehouse', to: 'Abuja Fulfillment Warehouse', items: 1, qty: 8, eta: '01 Oct 2026', status: 'Cancelled', owner: 'J. Okafor' },
]

export const inventoryCounts = [
  { ref: 'CNT-261003-0012', warehouse: 'Lagos Main Warehouse', location: 'Aisle A + B', products: 84, expected: 1240, counted: null, variance: null, date: '03 Oct 2026', status: 'In Progress', owner: 'J. Okafor' },
  { ref: 'CNT-261004-0013', warehouse: 'Abuja Fulfillment Warehouse', location: 'All locations', products: 210, expected: 3890, counted: null, variance: null, date: '04 Oct 2026', status: 'Scheduled', owner: 'M. Yusuf' },
  { ref: 'CNT-261001-0009', warehouse: 'Lagos Main Warehouse', location: 'Aisle C', products: 61, expected: 860, counted: 856, variance: -4, date: '01 Oct 2026', status: 'Completed', owner: 'T. Bello' },
]

export const inventoryReservations = [
  { ref: 'SO-261003-0114', customer: 'Meridian Retail Ltd', product: 'Premium Office Chair', sku: 'SKU-1001', qty: 20, expires: '08 Oct 2026', status: 'Active', warehouse: 'Lagos Main Warehouse' },
  { ref: 'SO-261002-0107', customer: 'Atlas Business Hub', product: 'Wireless Keyboard', sku: 'SKU-1003', qty: 14, expires: '06 Oct 2026', status: 'Active', warehouse: 'Lagos Main Warehouse' },
  { ref: 'QUO-261001-0062', customer: 'Nova Stores', product: 'USB-C Hub', sku: 'SKU-1004', qty: 6, expires: '04 Oct 2026', status: 'Expiring Soon', warehouse: 'Lagos Main Warehouse' },
  { ref: 'SO-260930-0098', customer: 'Crestline Ltd', product: 'Barcode Scanner', sku: 'SKU-1006', qty: 9, expires: '10 Oct 2026', status: 'Active', warehouse: 'Abuja Fulfillment Warehouse' },
]

export const inventoryBatches = [
  { id: 'BAT-1001-A', product: 'Premium Office Chair', sku: 'SKU-1001', warehouse: 'Lagos Main Warehouse', quantity: 64, expires: '12 Nov 2026', status: 'Expiring' },
  { id: 'BAT-1001-B', product: 'Premium Office Chair', sku: 'SKU-1001', warehouse: 'Lagos Main Warehouse', quantity: 84, expires: '18 Jun 2027', status: 'Available' },
  { id: 'BAT-1003-A', product: 'Wireless Keyboard', sku: 'SKU-1003', warehouse: 'Lagos Main Warehouse', quantity: 22, expires: '30 Sep 2026', status: 'Expired' },
  { id: 'BAT-1006-A', product: 'Barcode Scanner', sku: 'SKU-1006', warehouse: 'Abuja Fulfillment Warehouse', quantity: 12, expires: '05 Feb 2027', status: 'Blocked' },
]

export const inventoryWarehouses = [
  { id: 'WH-LAGOS', name: 'Lagos Main Warehouse', code: 'LAG-MAIN', shelves: 18, variants: 124, status: 'Active' },
  { id: 'WH-ABUJA', name: 'Abuja Fulfillment Warehouse', code: 'ABJ-FUL', shelves: 12, variants: 86, status: 'Active' },
  { id: 'WH-IBADAN', name: 'Ibadan Storage', code: 'IBA-STO', shelves: 6, variants: 0, status: 'Archived' },
]

export const inventoryQuarantine = [
  { id: 'QTN-261003-0012', product: 'USB-C Hub', sku: 'SKU-1004', warehouse: 'Lagos Main Warehouse', quantity: 3, reason: 'Packaging damaged', status: 'Awaiting Review' },
  { id: 'QTN-261002-0008', product: 'Thermal Receipt Roll', sku: 'SKU-1005', warehouse: 'Lagos Main Warehouse', quantity: 8, reason: 'Quality inspection', status: 'Awaiting Review' },
]
