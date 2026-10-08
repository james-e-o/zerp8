'use client'

import { useEffect, useState } from 'react'
import supabase from '@/config/supabaseClient'

const flattenProducts = (products, variants, currencies) => {
  const variantsByProduct = (variants || []).reduce((map, variant) => {
    const productId = variant.product_id || variant.productId || variant.product
    if (!productId) return map

    map[productId] = [...(map[productId] || []), variant]
    return map
  }, {})

  return (products || []).flatMap((product) => {
    const productVariants =
      product.product_variants ||
      product.variants ||
      variantsByProduct[product.id] ||
      []

    return productVariants.map((variant) => {
      const variantLabel =
        variant.variant_label || variant.variantLabel || 'Default'
      const productTitle = product.title || product.name || 'Untitled product'
      const currency = (currencies || []).find(
        (entry) => entry.code === variant.cost_currency
      )

      return {
        ...variant,
        productId: product.id,
        productTitle,
        variantLabel,
        sku: variant.sku || '',
        costCurrencySymbol: currency?.symbol || '',
        displayName: `${productTitle} - ${variantLabel}`,
      }
    })
  })
}

// NOTE: products and product_variants are both company-wide now, not
// branch-scoped (see products-company-wide-migration.sql +
// product-access-and-cost-migration.sql). products.branch was renamed to
// created_by_branch and is no longer part of any access rule;
// product_variants.branch was dropped entirely. Which products/variants
// a branch can see is enforced entirely by RLS (products_select /
// product_variants_select, via access_scope + product_branch_access +
// can_access_product_resource) — so this hook does NOT filter by branch
// client-side. RLS already narrows the result to whatever this branch is
// allowed to view; there's no branch column left to filter on anyway.
export function useRequestCatalog(branchId) {
  const [catalog, setCatalog] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    if (!branchId) {
      setCatalog([])
      setLoading(false)
      return undefined
    }

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const [
          { data: products, error: productError },
          { data: variants, error: variantError },
          { data: currencies, error: currencyError },
        ] = await Promise.all([
          supabase
            .from('products')
            .select('id, title')
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
          supabase
            .from('product_variants')
            .select('*')
            .eq('is_active', true),
          supabase
            .from('currencies')
            .select('code, symbol'),
        ])

        if (productError) throw productError
        if (variantError) throw variantError
        if (currencyError) throw currencyError
        if (!mounted) return

        setCurrencies(currencies || [])
        setCatalog(flattenProducts(products, variants, currencies))
      } catch (loadError) {
        console.error('Failed to load purchase request catalog:', loadError)
        if (mounted) {
          setCatalog([])
          setCurrencies([])
          setError('Products could not be loaded for this branch.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [branchId])

  return { catalog, currencies, loading, error }
}