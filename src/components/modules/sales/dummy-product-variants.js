// The catalog itself now comes from useQuotationCatalog() (live Supabase
// query against products / product_variants / standard_prices), so the
// in-memory dummy catalog that used to live in this file has been removed.
// Keep a minimal compatibility export so older quotation edit flows still
// compile while the live catalog is the real source of truth.

export const DUMMY_VARIANT_INDEX = [];

export function emptyQuotationLine() {
  return { variantId: '', productId: '', productTitle: '', variantLabel: '', sku: '', qty: 1, unitPrice: 0, discountType: 'amount', discountValue: 0 }
}