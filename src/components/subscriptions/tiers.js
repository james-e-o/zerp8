export const NUMERIC_TIERS = {
  'products.max_active': [100, 500, 2000, 10000],
  'sales_orders.max_per_month': [100, 500, 2000, 10000],
  'purchase_orders.max_per_month': [50, 250, 1000, 5000],
  'crm_contacts.max_count': [100, 500, 2500, 10000],
}

export const BUTTON_TIERS = {
  'branches.max_count': [1, 2, 5, 15],
  'staff.max_count': [5, 10, 30, 100],
  'warehouses.max_count': [1, 2, 5, 10],
}

export const isButtonLimit = (key) => Object.hasOwn(BUTTON_TIERS, key)
export const getTiers = (key) => NUMERIC_TIERS[key] || BUTTON_TIERS[key] || []
