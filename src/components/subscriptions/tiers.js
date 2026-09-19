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

// Price ADDED at each tier index, relative to the bundle's base_price.
// Index 0 is always 0 — the first tier is what base_price already buys;
// every tier above it is what increases the total as the user slides up.
export const NUMERIC_TIER_PRICES = {
  'products.max_active': [0, 4000, 12000, 30000],
  'sales_orders.max_per_month': [0, 3000, 9000, 22000],
  'purchase_orders.max_per_month': [0, 2500, 7500, 18000],
  'crm_contacts.max_count': [0, 2500, 8000, 20000],
}

export const BUTTON_TIER_PRICES = {
  'branches.max_count': [0, 3000, 8000, 20000],
  'staff.max_count': [0, 2000, 6000, 15000],
  'warehouses.max_count': [0, 2000, 5000, 12000],
}

export const isButtonLimit = (key) => Object.hasOwn(BUTTON_TIERS, key)
export const getTiers = (key) => NUMERIC_TIERS[key] || BUTTON_TIERS[key] || []

// Returns the price delta for the currently selected tier value of a given
// limit key — 0 if the value isn't found or is the first (included) tier.
export const getTierPrice = (key, value) => {
  const tiers = getTiers(key)
  const prices = NUMERIC_TIER_PRICES[key] || BUTTON_TIER_PRICES[key] || []
  const index = tiers.indexOf(value)
  return index >= 0 ? (prices[index] ?? 0) : 0
}