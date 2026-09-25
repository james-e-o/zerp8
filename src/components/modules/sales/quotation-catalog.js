'use client'

import { useEffect, useMemo, useState } from 'react'
import supabase from '@/config/supabaseClient'

const getBasePrice = (variant) => Number(
  variant.selling_price ?? variant.sellingPrice ?? variant.standard_price ?? variant.price ?? 0
)

export function resolveQuotationPrice(variant, pricingContextId, pricingRules, quantity = 1) {
  const basePrice = getBasePrice(variant)
  if (!pricingContextId || !basePrice) return basePrice

  const productId = variant.product_id || variant.productId || variant.product
  const rule = pricingRules
    .filter((item) => item.pricing_context === pricingContextId)
    .filter((item) => (
      (item.scope_type === 'product' && item.scope_id === productId) ||
      (item.scope_type === 'variant' && item.scope_id === variant.id) ||
      (item.scope_type === 'all_products' && !item.scope_id)
    ))
    .filter((item) => {
      if (item.condition_type === 'bulk_threshold') return Number(quantity) >= Number(item.condition_value || 0)
      return item.condition_type === 'always' || !item.condition_type
    })
    .sort((left, right) => (right.priority || 0) - (left.priority || 0))[0]

  if (!rule) return basePrice
  const value = Number(rule.action_value || 0)
  if (rule.action_type === 'percentage') return Math.max(0, basePrice + (value < 0 ? basePrice * Math.abs(value) / 100 : -basePrice * value / 100))
  return Math.max(0, basePrice + (value < 0 ? Math.abs(value) : -value))
}

const flattenProducts = (products, variants) => {
  const variantsByProduct = variants.reduce((map, variant) => {
    const productId = variant.product_id || variant.productId || variant.product
    if (!productId) return map
    map[productId] = [...(map[productId] || []), variant]
    return map
  }, {})

  return products.flatMap((product) => {
    const productVariants = product.product_variants || product.variants || variantsByProduct[product.id] || []
    return productVariants.map((variant) => ({
      ...variant,
      productId: product.id,
      productTitle: product.title || product.name || 'Untitled product',
      variantLabel: variant.variant_label || variant.variantLabel || 'Default',
      sku: variant.sku || '',
      displayName: `${product.title || product.name || 'Untitled product'}${(variant.variant_label || variant.variantLabel) ? ` - ${variant.variant_label || variant.variantLabel}` : ''}`,
    }))
  })
}

// IMPORTANT: `standard_prices` rows carry their own primary key (`id`), which
// is unrelated to the variant's id. Spreading the whole price row over the
// variant would silently overwrite variant.id with that price row's id,
// which then breaks anything that keys off the real product_variants.id
// (variant-scoped pricing rules, the details dialog lookup, etc). So we only
// pull the specific pricing fields we need off the price row, and keep the
// price row's own id around separately (as `standardPriceId`) in case it's
// ever needed for an update.
const attachStandardPrices = (catalog, priceRows) => catalog.map((variant) => {
  const price = (priceRows || []).find((row) => row.variant === variant.id)
  if (!price) return variant
  return {
    ...variant,
    selling_price: price.selling_price,
    margin_percentage: price.margin_percentage,
    currency: price.currency,
    standardPriceId: price.id,
  }
})

export function useQuotationCatalog(branchId) {
  const [contexts, setContexts] = useState([])
  const [catalog, setCatalog] = useState([])
  const [pricingRules, setPricingRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    let mounted = true
    if (!branchId) return undefined

    const load = async () => {
      setLoading(true)
      setError('')
      setWarning('')
      try {
        const [{ data: contextRows, error: contextError }, { data: productRows, error: productError }] = await Promise.all([
          supabase.from('pricing_contexts').select('*').eq('branch', branchId).eq('is_active', true).order('is_default', { ascending: false }).order('priority', { ascending: false }),
          supabase.from('products').select('id,title,handle,sub_title,description,type,brand').eq('branch', branchId).eq('status', 'active').order('created_at', { ascending: false }),
        ])

        if (contextError) throw contextError
        if (productError) throw productError

        const productIds = (productRows || []).map((product) => product.id)
        const contextIds = (contextRows || []).map((context) => context.id)
        const [{ data: variantRows, error: variantError }, { data: rules, error: rulesError }, { data: standardPrices, error: standardPricesError }] = await Promise.all([
          productIds.length
            ? supabase.from('product_variants').select('*').in('product', productIds).eq('branch', branchId).eq('is_active', true)
            : Promise.resolve({ data: [], error: null }),
          contextIds.length
            ? supabase.from('pricing_rules').select('*').in('pricing_context', contextIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('standard_prices').select('*').eq('branch', branchId),
        ])

        if (variantError) throw variantError

        const warnings = []
        if (rulesError) { console.warn('Quotation pricing rules could not be loaded:', rulesError); warnings.push('pricing rules') }
        if (standardPricesError) { console.warn('Quotation standard prices could not be loaded:', standardPricesError); warnings.push('standard prices') }

        if (!mounted) return
        setContexts(contextRows || [])
        setCatalog(attachStandardPrices(flattenProducts(productRows || [], variantRows || []), standardPrices || []))
        setPricingRules(rules || [])
        if (warnings.length) setWarning(`Could not load ${warnings.join(' and ')} — prices shown may be incomplete.`)
      } catch (loadError) {
        console.error('Failed to load quotation catalog:', loadError)
        if (mounted) setError('Products or pricing contexts could not be loaded for this branch.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [branchId])

  const defaultContext = useMemo(
    () => contexts.find((context) => context.is_default) || contexts[0] || null,
    [contexts]
  )

  return { contexts, defaultContext, catalog, pricingRules, loading, error, warning }
}