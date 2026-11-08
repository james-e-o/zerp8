export const DUMMY_SUPPLIERS = [
  {
    id: 'SUP-001',
    name: 'Lagos Wholesale Hub',
    email: 'orders@lagoswholesale.example',
    phone: '+234 801 234 5678',
    address: '12 Marina Road, Lagos',
    paymentTerms: 'Net 30',
    creditLimit: 2500000,
    outstandingBalance: 480000,
  },
  {
    id: 'SUP-002',
    name: 'Prime Goods Distribution',
    email: 'sales@primegoods.example',
    phone: '+234 802 345 6789',
    address: '8 Industrial Avenue, Ikeja',
    paymentTerms: 'Net 15',
    creditLimit: 1500000,
    outstandingBalance: 0,
  },
]

export function formatNaira(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0)
}

export function formatCurrency(value, currencyCode, currencySymbol) {
  const numericValue = Number(value || 0)
  const formattedNumber = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(numericValue)

  if (currencySymbol) return `${currencySymbol}${formattedNumber}`

  if (!currencyCode) {
    return formattedNumber
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(numericValue)
  } catch {
    return `${currencyCode} ${formattedNumber}`
  }
}
