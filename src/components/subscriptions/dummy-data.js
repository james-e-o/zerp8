// Temporary subscription catalog data for frontend work while the Bachs.io
// subscription and entitlement schema is being finalized.

export const DUMMY_SUBSCRIPTION_BUNDLES = [
  {
    id: 'dummy-core-commerce',
    key: 'core_commerce_inventory',
    name: 'Core Commerce & Inventory',
    description: 'Products, sales, purchases, and inventory operations.',
    base_price: 15000,
    currency: 'NGN',
    modules: ['Products', 'Sales', 'Purchases', 'Inventory'],
    limitKeys: [
      'products.max_active',
      'sales_orders.max_per_month',
      'purchase_orders.max_per_month',
      'branches.max_count',
      'staff.max_count',
      'warehouses.max_count',
    ],
  },
  {
    id: 'dummy-crm',
    key: 'crm',
    name: 'CRM',
    description: 'Customers, leads, and relationship management.',
    base_price: 8000,
    currency: 'NGN',
    modules: ['Customers', 'Leads', 'Opportunities'],
    limitKeys: ['crm_contacts.max_count'],
  },
  {
    id: 'dummy-accounting',
    key: 'accounting',
    name: 'Accounting',
    description: 'Financials, journals, and reports.',
    base_price: 10000,
    currency: 'NGN',
    modules: ['Financials', 'Journals', 'Reports'],
    limitKeys: [],
  },
]

export const DUMMY_SUBSCRIPTION_LIMITS = {
  'products.max_active': { value: 500, unit: 'products' },
  'sales_orders.max_per_month': { value: 500, unit: 'orders/month' },
  'purchase_orders.max_per_month': { value: 250, unit: 'orders/month' },
  'branches.max_count': { value: 2, unit: 'branches' },
  'staff.max_count': { value: 10, unit: 'staff' },
  'warehouses.max_count': { value: 1, unit: 'warehouses' },
  'crm_contacts.max_count': { value: 500, unit: 'contacts' },
}

export const DUMMY_SUBSCRIPTION_USAGE = {
  'products.max_active': 0,
  'sales_orders.max_per_month': 0,
  'purchase_orders.max_per_month': 0,
  'branches.max_count': 0,
  'staff.max_count': 0,
  'warehouses.max_count': 0,
  'crm_contacts.max_count': 0,
}
