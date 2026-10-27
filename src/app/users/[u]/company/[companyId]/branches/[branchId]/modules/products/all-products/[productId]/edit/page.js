'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X, Star, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import AddImage from '@/components/add-image'
import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

// ----------------------------------------------------------------------
// EditProductPage
// ----------------------------------------------------------------------
// Route: .../modules/products/all-products/[productId]/edit
//
// Everything is saved in one call to update_product_with_variants, so a
// refusal (for example stock blocking a tracking change) saves nothing.
//
// What can be edited here
//   Details    title, subtitle, handle, this branch's alias, description,
//              brand, category, images, size/weight, warranty
//   Variants   SKU, identifiers, cost estimate (company-wide), selling price
//              and margin (THIS branch), selling rules, images, active,
//              listed in shop, this branch's pricing-context adjustments
//   Inventory  stocked goods, batch tracking, expiry, shelf life
//
// What cannot be edited here (on purpose)
//   - Product type (physical / service): history depends on it.
//   - Adding or removing variants / option combinations.
//
// Stock rules shown to the user (enforced again by the database)
//   - Stocked goods cannot be turned off while any branch holds stock.
//   - Batch tracking can only be changed while the variant has no stock.
//   - Deactivating a variant stops it being added to NEW purchase requests
//     and orders. Stock that is still held can still be sold.
//   - Listed in shop only controls the e-shop listing, not stock.
// ----------------------------------------------------------------------

function convertToSlug(input) {
  return input
    .toString()
    .toLowerCase()
    .replace(/['"]/g, '')
    .trim()
    .replace(/\band\b/g, '&')
    .replace(/[^a-z0-9\&-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/&/g, 'and')
}

const toNum = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}
const fixed2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '')
const str = (value) => (value === null || value === undefined ? '' : String(value))

const imageUrl = (img) => (typeof img === 'string' ? img : img?.url || img?.src || '')

function marginFrom(cost, selling) {
  const c = toNum(cost)
  const s = toNum(selling)
  if (!c || c <= 0 || s === null) return ''
  return fixed2(((s - c) / c) * 100)
}

function FieldLabel({ children, required, optional }) {
  return (
    <Label className="mb-1 block text-xs font-medium">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
      {optional ? <span className="ml-1 text-neutral-400">(Optional)</span> : null}
    </Label>
  )
}

function Note({ tone = 'info', children }) {
  const styles = tone === 'warn'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-border bg-muted text-muted-foreground'
  const Icon = tone === 'warn' ? AlertTriangle : Info
  return (
    <div className={`flex items-start gap-2 rounded-sm border p-2 text-[11px] ${styles}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function SwitchRow({ checked, onChange, disabled, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{title}</p>
        {children ? <div className="mt-0.5 text-[10px] text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  )
}

export default function EditProductPage() {
  const router = useRouter()
  const { u, companyId, branchId, productId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const productsBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products`
  const detailPath = `${productsBase}/${productId}`
  const branchCurrency = currentBranch?.base_currency || ''
  const companyKey = currentBranch?.company || companyId

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  const [productType, setProductType] = useState('physical')
  const [companyCurrency, setCompanyCurrency] = useState('')

  // Details
  const [form, setForm] = useState({
    title: '', subtitle: '', handle: '', alias: '', description: '', brand: '', categoryId: '',
    weight: '', weightUnit: 'kg', length: '', width: '', height: '', dimensionUnit: 'cm', warranty: '',
  })
  const [originalHandle, setOriginalHandle] = useState('')
  const [images, setImages] = useState([])
  const [categories, setCategories] = useState([])

  // Variants
  const [variants, setVariants] = useState([])

  // Pricing contexts (this branch)
  const [contexts, setContexts] = useState([])
  const [adjustments, setAdjustments] = useState({})
  const [rulesLoaded, setRulesLoaded] = useState(false)

  const initialRef = useRef('')

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const patchVariant = (id, patch) =>
    setVariants((prev) => prev.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)))

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!productId || !branchId) return
      setLoading(true)
      setLoadError('')

      try {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle()
        if (productError) throw productError
        if (!product) throw new Error('Product not found, or you do not have access to it.')

        const { data: variantRows, error: variantError } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product', productId)
          .order('created_at', { ascending: true })
        if (variantError) throw variantError

        const ids = (variantRows || []).map((row) => row.id)

        const [costRes, priceRes, flagRes, aliasRes, companyRes, catRes, ctxRes] = await Promise.all([
          ids.length
            ? supabase.from('product_cost_estimates').select('variant_id,cost_price,cost_currency').in('variant_id', ids)
            : Promise.resolve({ data: [] }),
          ids.length
            ? supabase.from('standard_prices').select('variant,selling_price,margin_percentage').eq('branch', branchId).in('variant', ids)
            : Promise.resolve({ data: [] }),
          supabase.rpc('product_variant_stock_flags', { p_product: productId }),
          supabase.from('product_branch_aliases').select('alias_name').eq('product', productId).eq('branch', branchId).maybeSingle(),
          supabase.from('companies').select('default_currency').eq('id', companyKey).maybeSingle(),
          supabase.from('categories').select('id,name,parent').eq('company', companyKey),
          supabase.from('pricing_contexts').select('id,name,is_default').eq('branch', branchId).eq('is_active', true),
        ])

        if (costRes.error) throw costRes.error
        if (priceRes.error) throw priceRes.error
        if (flagRes.error) throw flagRes.error

        const costBy = Object.fromEntries((costRes.data || []).map((row) => [row.variant_id, row]))
        const priceBy = Object.fromEntries((priceRes.data || []).map((row) => [row.variant, row]))
        const flagBy = Object.fromEntries((flagRes.data || []).map((row) => [row.variant, row]))

        const nextVariants = (variantRows || []).map((row) => {
          const cost = costBy[row.id]
          const price = priceBy[row.id]
          const flags = flagBy[row.id] || {}
          return {
            id: row.id,
            label: row.variant_label || 'Default variant',
            sku: row.sku || '',
            mpn: str(row.mpn), upc: str(row.upc), ean: str(row.ean), isbn: str(row.isbn),
            minSale: str(row.min_sale_quantity ?? 1),
            increment: str(row.quantity_increment ?? 1),
            bulk: str(row.bulk_threshold),
            isActive: row.is_active !== false,
            trackedShop: row.is_tracked_shop !== false,
            tracked: row.is_tracked_inventory === true,
            trackingMode: row.tracking_mode || 'none',
            requiresExpiry: row.requires_expiry === true,
            shelfLife: str(row.shelf_life_days),
            cost: str(cost?.cost_price),
            costCurrency: cost?.cost_currency || '',
            selling: str(price?.selling_price),
            margin: price?.margin_percentage !== null && price?.margin_percentage !== undefined
              ? fixed2(Number(price.margin_percentage))
              : marginFrom(cost?.cost_price, price?.selling_price),
            hasPrice: !!price,
            images: Array.isArray(row.images) ? row.images : [],
            holdsStock: flags.holds_stock === true,
            holdsBatchStock: flags.holds_batch_stock === true,
          }
        })

        const nextForm = {
          title: product.title || '',
          subtitle: product.sub_title || '',
          handle: product.handle || '',
          alias: aliasRes?.data?.alias_name || '',
          description: product.description || '',
          brand: product.brand || '',
          categoryId: product.category || '',
          weight: str(product.weight),
          weightUnit: product.weight_unit || 'kg',
          length: str(product.length),
          width: str(product.width),
          height: str(product.height),
          dimensionUnit: product.dimension_unit || 'cm',
          warranty: product.warranty_information || '',
        }
        const nextImages = Array.isArray(product.images) ? product.images : []

        // Other pricing contexts of this branch and their product-specific rules.
        const otherContexts = (ctxRes.data || []).filter((context) => !context.is_default)
        const nextAdjustments = {}
        let loadedRules = false
        if (otherContexts.length > 0) {
          const { data: ruleRows, error: ruleError } = await supabase
            .from('pricing_rules')
            .select('pricing_context,action_type,action_value')
            .eq('scope_type', 'product')
            .eq('scope_id', productId)
            .eq('condition_type', 'always')
            .in('pricing_context', otherContexts.map((context) => context.id))
          if (!ruleError) {
            loadedRules = true
            ;(ruleRows || []).forEach((rule) => {
              const value = Number(rule.action_value)
              nextAdjustments[rule.pricing_context] = {
                mode: value < 0 ? 'markup' : 'reduction',
                adjustmentType: rule.action_type === 'fixed' ? 'fixed' : 'percentage',
                value: str(Math.abs(value)),
              }
            })
          }
        }

        if (cancelled) return
        setProductType(product.type || 'physical')
        setCompanyCurrency(companyRes?.data?.default_currency || '')
        setForm(nextForm)
        setOriginalHandle(product.handle || '')
        setImages(nextImages)
        setVariants(nextVariants)
        setCategories(catRes?.data || [])
        setContexts(otherContexts)
        setAdjustments(nextAdjustments)
        setRulesLoaded(loadedRules)

        initialRef.current = JSON.stringify({ nextForm, nextImages, nextVariants: stripFlags(nextVariants), nextAdjustments })
      } catch (error) {
        console.error('Failed to load product for editing:', error)
        if (!cancelled) setLoadError(error.message || 'Could not load this product.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [productId, branchId, companyKey])

  // Images chosen in the media dialog arrive as a window event (same
  // mechanism the create page uses).
  useEffect(() => {
    const handler = (event) => {
      const incoming = Array.isArray(event?.detail) ? event.detail : []
      if (incoming.length === 0) return
      setImages((prev) => {
        const next = [...prev]
        incoming.forEach((img) => {
          const url = img.url || img.src
          if (url && !next.some((existing) => imageUrl(existing) === url)) {
            next.push({ url, alt: img.alt || '' })
          }
        })
        return next
      })
    }
    window.addEventListener('nexshelf:selectedImages', handler)
    return () => window.removeEventListener('nexshelf:selectedImages', handler)
  }, [])

  const isDirty = useMemo(() => {
    if (loading || !initialRef.current) return false
    return JSON.stringify({
      nextForm: form, nextImages: images, nextVariants: stripFlags(variants), nextAdjustments: adjustments,
    }) !== initialRef.current
  }, [form, images, variants, adjustments, loading])

  useEffect(() => {
    if (!isDirty) return undefined
    const handler = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ------------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------------
  const isService = productType === 'service'

  const categoryOptions = useMemo(() => {
    const byId = Object.fromEntries(categories.map((category) => [category.id, category]))
    const pathOf = (category) => {
      const parts = [category.name]
      let guard = 0
      let parent = category.parent ? byId[category.parent] : null
      while (parent && guard < 10) { parts.unshift(parent.name); parent = parent.parent ? byId[parent.parent] : null; guard += 1 }
      return parts.join(' › ')
    }
    return categories
      .map((category) => ({ id: category.id, label: pathOf(category) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [categories])

  const firstActive = variants.find((variant) => variant.isActive) || variants[0]
  const previewBase = toNum(firstActive?.selling)

  const previewFor = (adjustment) => {
    const value = toNum(adjustment?.value)
    if (previewBase === null || value === null) return ''
    if (adjustment.adjustmentType === 'percentage') {
      return fixed2(adjustment.mode === 'reduction' ? previewBase * (1 - value / 100) : previewBase * (1 + value / 100))
    }
    return fixed2(adjustment.mode === 'reduction' ? previewBase - value : previewBase + value)
  }

  const updateAdjustment = (contextId, patch) =>
    setAdjustments((prev) => ({
      ...prev,
      [contextId]: { mode: 'reduction', adjustmentType: 'percentage', value: '', ...(prev[contextId] || {}), ...patch },
    }))

  // Pricing sync for a variant row.
  // Changing the cost estimate does NOT move the selling price: customers
  // should not see a price change because an estimate was corrected. The
  // margin is recalculated instead.
  const onCost = (id, value) => {
    const row = variants.find((variant) => variant.id === id)
    patchVariant(id, { cost: value, margin: marginFrom(value, row?.selling) })
  }
  const onMargin = (id, value) => {
    const row = variants.find((variant) => variant.id === id)
    const cost = toNum(row?.cost)
    const margin = toNum(value)
    const patch = { margin: value }
    if (cost !== null && margin !== null) patch.selling = fixed2(cost * (1 + margin / 100))
    patchVariant(id, patch)
  }
  const onSelling = (id, value) => {
    const row = variants.find((variant) => variant.id === id)
    patchVariant(id, { selling: value, margin: marginFrom(row?.cost, value) })
  }

  // Product images
  const makePrimary = (index) =>
    setImages((prev) => { const next = [...prev]; const [moved] = next.splice(index, 1); next.unshift(moved); return next })
  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index))

  // Variant image pool = product images + anything the variant already has.
  const poolFor = (variant) => {
    const pool = [...images]
    variant.images.forEach((img) => {
      if (!pool.some((existing) => imageUrl(existing) === imageUrl(img))) pool.push(img)
    })
    return pool
  }
  const toggleVariantImage = (variant, img) => {
    const url = imageUrl(img)
    const has = variant.images.some((existing) => imageUrl(existing) === url)
    patchVariant(variant.id, {
      images: has ? variant.images.filter((existing) => imageUrl(existing) !== url) : [...variant.images, img],
    })
  }

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------
  const validate = () => {
    if (!form.title.trim()) return ['details', 'Give the product a title.']
    if (!convertToSlug(form.handle)) return ['details', 'The handle cannot be empty.']

    const seen = new Set()
    for (const variant of variants) {
      const name = variant.label
      const sku = variant.sku.trim()
      if (!sku) return ['variants', `${name}: a SKU is required.`]
      if (seen.has(sku.toLowerCase())) return ['variants', `Two variants use the SKU "${sku}".`]
      seen.add(sku.toLowerCase())

      if (variant.selling === '' || toNum(variant.selling) === null || toNum(variant.selling) < 0) {
        return ['variants', `${name}: enter a selling price.`]
      }
      if (!isService && (variant.cost === '' || toNum(variant.cost) === null || toNum(variant.cost) < 0)) {
        return ['variants', `${name}: enter a cost estimate.`]
      }
      if (variant.minSale !== '' && !(parseInt(variant.minSale, 10) >= 1)) return ['variants', `${name}: minimum sale quantity must be at least 1.`]
      if (variant.increment !== '' && !(parseInt(variant.increment, 10) >= 1)) return ['variants', `${name}: quantity increment must be at least 1.`]
      if (variant.bulk !== '' && !(parseInt(variant.bulk, 10) >= 1)) return ['variants', `${name}: bulk threshold must be at least 1.`]
      if (variant.shelfLife !== '' && !(parseInt(variant.shelfLife, 10) >= 1)) return ['inventory', `${name}: shelf life must be at least 1 day.`]
    }
    return null
  }

  const handleSave = async () => {
    const problem = validate()
    if (problem) {
      setActiveTab(problem[0])
      toast.error(problem[1])
      return
    }

    setSaving(true)
    try {
      const cleanedImages = images.map((img, index) => ({
        url: imageUrl(img),
        alt: (typeof img === 'object' && img.alt) || form.title,
        display_order: index,
        is_primary: index === 0,
      }))

      const fields = {
        title: form.title.trim(),
        sub_title: form.subtitle,
        handle: convertToSlug(form.handle),
        branch_alias: form.alias,
        description: form.description,
        brand: form.brand,
        category: form.categoryId || '',
        images: cleanedImages,
        warranty_information: form.warranty,
        ...(isService ? {} : {
          weight: form.weight,
          weight_unit: form.weightUnit,
          length: form.length,
          width: form.width,
          height: form.height,
          dimension_unit: form.dimensionUnit,
        }),
      }

      const variantPayload = variants.map((variant) => {
        const pool = poolFor(variant)
        const chosen = pool
          .filter((img) => variant.images.some((existing) => imageUrl(existing) === imageUrl(img)))
          .map((img, index) => ({
            url: imageUrl(img),
            alt: (typeof img === 'object' && img.alt) || form.title,
            display_order: index,
            is_primary: index === 0,
          }))

        return {
          id: variant.id,
          sku: variant.sku.trim(),
          mpn: variant.mpn, upc: variant.upc, ean: variant.ean, isbn: variant.isbn,
          min_sale_quantity: variant.minSale,
          quantity_increment: variant.increment,
          bulk_threshold: variant.bulk,
          images: chosen,
          is_active: variant.isActive,
          is_tracked_shop: variant.trackedShop,
          ...(isService ? {} : {
            is_tracked_inventory: variant.tracked,
            tracking_mode: variant.tracked ? variant.trackingMode : 'none',
            requires_expiry: variant.tracked && variant.trackingMode === 'batch' && variant.requiresExpiry,
            shelf_life_days: variant.requiresExpiry ? variant.shelfLife : '',
          }),
          cost: variant.cost,
          selling_price: variant.selling,
          margin_percentage: variant.margin,
        }
      })

      const contextRules = rulesLoaded && contexts.length > 0
        ? {
            managed: contexts.map((context) => context.id),
            rules: contexts
              .filter((context) => adjustments[context.id]?.value !== undefined && adjustments[context.id]?.value !== '')
              .map((context) => {
                const adjustment = adjustments[context.id]
                const value = parseFloat(adjustment.value) || 0
                return {
                  pricing_context: context.id,
                  action_type: adjustment.adjustmentType,
                  // Same convention as the create page: a markup is stored negated.
                  action_value: adjustment.mode === 'markup' ? -value : value,
                }
              }),
          }
        : null

      const { data, error } = await supabase.rpc('update_product_with_variants', {
        p_branch: branchId,
        p_product: productId,
        p_fields: fields,
        p_variants: variantPayload,
        p_context_rules: contextRules,
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Could not save this product.')

      initialRef.current = ''
      toast.success('Product saved')
      router.push(detailPath)
    } catch (error) {
      console.error('Failed to save product:', error)
      toast.error(error.message || 'Could not save this product.')
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading product...</p>
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={productsBase}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to products
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">{loadError}</div>
      </div>
    )
  }

  const tabs = [
    ['details', 'Details'],
    ['variants', isService ? 'Quality tiers' : 'Variants'],
    ...(isService ? [] : [['inventory', 'Inventory']]),
  ]
  const inactiveCount = variants.filter((variant) => !variant.isActive).length

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={detailPath}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {isService ? 'Service' : 'Physical'} · type cannot be changed
          </span>
          {isDirty ? <span className="text-[10px] text-amber-700">Unsaved changes</span> : null}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-medium text-muted-foreground">Editing</p>
        <h1 className="text-lg font-semibold text-foreground">{form.title || 'Untitled product'}</h1>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {tabs.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            onClick={() => setActiveTab(key)}
            className={`h-7 rounded-sm px-3 text-xs ${activeTab === key ? 'bg-neutral-800 text-neutral-50 hover:bg-neutral-800 hover:text-neutral-50' : 'text-neutral-600'}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* ------------------------------ DETAILS ------------------------------ */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <section className="space-y-4 rounded-sm border border-border bg-card p-4">
            <h2 className="text-xs font-semibold">General</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <FieldLabel required>{isService ? 'Service name' : 'Title'}</FieldLabel>
                <Input value={form.title} onChange={(e) => setField('title', e.target.value)} className="text-xs" />
              </div>
              <div>
                <FieldLabel optional>Subtitle</FieldLabel>
                <Input value={form.subtitle} onChange={(e) => setField('subtitle', e.target.value)} className="text-xs" />
              </div>
              <div>
                <FieldLabel required>Handle</FieldLabel>
                <div className="flex">
                  <span className="rounded-sm rounded-r-none border border-r-0 bg-neutral-100 px-2 py-2 text-xs text-neutral-500">/</span>
                  <Input
                    value={form.handle}
                    onChange={(e) => setField('handle', convertToSlug(e.target.value))}
                    className="rounded-l-none text-xs"
                  />
                </div>
                {convertToSlug(form.handle) !== originalHandle ? (
                  <p className="mt-1 text-[10px] text-amber-700">
                    Changing the handle changes this product&apos;s web address in the shop.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <FieldLabel optional>Alias for this branch</FieldLabel>
              <Input
                value={form.alias}
                onChange={(e) => setField('alias', e.target.value)}
                placeholder="How this branch sees the product's name (blank = use the title)"
                className="text-xs"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                The title and handle are shared by every branch. The alias is only this branch&apos;s display name.
              </p>
            </div>

            <div>
              <FieldLabel optional>Description</FieldLabel>
              <Textarea rows={5} value={form.description} onChange={(e) => setField('description', e.target.value)} className="text-xs" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {!isService && (
                <div>
                  <FieldLabel optional>Brand / manufacturer</FieldLabel>
                  <Input value={form.brand} onChange={(e) => setField('brand', e.target.value)} className="text-xs" />
                </div>
              )}
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  value={form.categoryId}
                  onChange={(e) => setField('categoryId', e.target.value)}
                  className="h-9 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
                >
                  <option value="">No category</option>
                  {form.categoryId && !categoryOptions.some((option) => option.id === form.categoryId) ? (
                    <option value={form.categoryId}>(current category)</option>
                  ) : null}
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-sm border border-border bg-card p-4">
            <AlertDialog>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold">Media</h2>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="h-7 rounded-sm px-2 text-xs">
                    <Upload className="mr-1.5 size-3.5" /> Add / choose images
                  </Button>
                </AlertDialogTrigger>
              </div>

              {images.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
                  No images yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {images.map((img, index) => (
                    <div key={`${imageUrl(img)}-${index}`} className="w-28">
                      <div className="relative h-28 overflow-hidden rounded-sm border border-border bg-muted">
                        <img src={imageUrl(img)} alt="" className="size-full object-contain" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          title="Remove image"
                          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white"
                        >
                          <X className="size-3" />
                        </button>
                        {index === 0 ? (
                          <span className="absolute bottom-1 left-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] text-white">Main</span>
                        ) : null}
                      </div>
                      {index !== 0 ? (
                        <button
                          type="button"
                          onClick={() => makePrimary(index)}
                          className="mt-1 flex items-center gap-1 text-[10px] text-core hover:underline"
                        >
                          <Star className="size-3" /> Make main
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <AlertDialogContent className="flex h-5/6 w-11/12 max-w-[90%] flex-col justify-between gap-0 overflow-hidden rounded-lg bg-white p-0 duration-100 md:h-[87%] md:w-[83%] md:max-w-[80%]">
                <AlertDialogHeader>
                  <AlertDialogTitle></AlertDialogTitle>
                  <AlertDialogDescription>
                    <span className="py-1 text-start text-xs font-semibold md:mx-5">Media files</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AddImage />
              </AlertDialogContent>
            </AlertDialog>
          </section>

          {!isService && (
            <section className="space-y-4 rounded-sm border border-border bg-card p-4">
              <h2 className="text-xs font-semibold">Size, weight and warranty</h2>
              <div>
                <FieldLabel optional>Dimensions (length × width × height)</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" placeholder="Length" value={form.length} onChange={(e) => setField('length', e.target.value)} className="text-xs" />
                  <span className="text-neutral-500">×</span>
                  <Input type="number" step="0.01" placeholder="Width" value={form.width} onChange={(e) => setField('width', e.target.value)} className="text-xs" />
                  <span className="text-neutral-500">×</span>
                  <Input type="number" step="0.01" placeholder="Height" value={form.height} onChange={(e) => setField('height', e.target.value)} className="text-xs" />
                  <select value={form.dimensionUnit} onChange={(e) => setField('dimensionUnit', e.target.value)} className="h-9 rounded-sm border border-input bg-transparent px-2 text-xs">
                    <option value="cm">cm</option><option value="m">m</option><option value="in">in</option><option value="ft">ft</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel optional>Weight</FieldLabel>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" value={form.weight} onChange={(e) => setField('weight', e.target.value)} className="text-xs" />
                    <select value={form.weightUnit} onChange={(e) => setField('weightUnit', e.target.value)} className="h-9 rounded-sm border border-input bg-transparent px-2 text-xs">
                      <option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option><option value="oz">oz</option>
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Warranty information</FieldLabel>
                  <Input value={form.warranty} onChange={(e) => setField('warranty', e.target.value)} className="text-xs" />
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ------------------------------ VARIANTS ------------------------------ */}
      {activeTab === 'variants' && (
        <div className="space-y-4">
          <Note>
            Adding or removing variants, or changing their option combinations, is not possible here yet. For each
            existing variant you can change the SKU, prices, selling rules, images and whether it is active.
          </Note>

          {inactiveCount > 0 && inactiveCount === variants.length ? (
            <Note tone="warn">
              Every variant is inactive, so nothing on this product can be added to a new purchase request or order.
            </Note>
          ) : null}

          {variants.map((variant) => {
            const marginValue = toNum(variant.selling) !== null && toNum(variant.cost) !== null
              ? fixed2(toNum(variant.selling) - toNum(variant.cost))
              : ''
            const pool = poolFor(variant)
            return (
              <section key={variant.id} className={`space-y-4 rounded-sm border border-border bg-card p-4 ${variant.isActive ? '' : 'opacity-80'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{variant.label}</p>
                    {!variant.isActive ? <span className="text-[10px] text-amber-700">Inactive</span> : null}
                  </div>
                  <div className="w-56">
                    <FieldLabel required>SKU</FieldLabel>
                    <Input value={variant.sku} onChange={(e) => patchVariant(variant.id, { sku: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <FieldLabel required={!isService} optional={isService}>
                      Cost estimate ({variant.costCurrency || companyCurrency || 'company'})
                    </FieldLabel>
                    <Input type="number" step="0.01" value={variant.cost} onChange={(e) => onCost(variant.id, e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <FieldLabel>Margin %</FieldLabel>
                    <Input type="number" step="0.01" value={variant.margin} onChange={(e) => onMargin(variant.id, e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <FieldLabel>Margin value</FieldLabel>
                    <Input readOnly value={marginValue} className="h-8 cursor-not-allowed bg-neutral-100 text-xs" />
                  </div>
                  <div>
                    <FieldLabel required>Selling price ({branchCurrency || 'this branch'})</FieldLabel>
                    <Input type="number" step="0.01" value={variant.selling} onChange={(e) => onSelling(variant.id, e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <p className="-mt-2 text-[10px] text-muted-foreground">
                  The cost is a company-wide estimate; once goods are received, real costs take over. Changing it here
                  does not change the selling price. The selling price is for this branch only.
                </p>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <FieldLabel>Minimum sale quantity</FieldLabel>
                    <Input type="number" min="1" value={variant.minSale} onChange={(e) => patchVariant(variant.id, { minSale: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <FieldLabel>Quantity increment</FieldLabel>
                    <Input type="number" min="1" value={variant.increment} onChange={(e) => patchVariant(variant.id, { increment: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <FieldLabel optional>Bulk threshold</FieldLabel>
                    <Input type="number" min="1" value={variant.bulk} onChange={(e) => patchVariant(variant.id, { bulk: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>

                {!isService && (
                  <div className="grid gap-3 md:grid-cols-4">
                    {[['mpn', 'MPN'], ['upc', 'UPC'], ['ean', 'EAN'], ['isbn', 'ISBN']].map(([key, label]) => (
                      <div key={key}>
                        <FieldLabel optional>{label}</FieldLabel>
                        <Input value={variant[key]} onChange={(e) => patchVariant(variant.id, { [key]: e.target.value })} className="h-8 text-xs" />
                      </div>
                    ))}
                  </div>
                )}

                {pool.length > 0 && (
                  <div>
                    <FieldLabel optional>Images for this variant</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {pool.map((img, index) => {
                        const selected = variant.images.some((existing) => imageUrl(existing) === imageUrl(img))
                        return (
                          <button
                            key={`${imageUrl(img)}-${index}`}
                            type="button"
                            onClick={() => toggleVariantImage(variant, img)}
                            className={`size-14 overflow-hidden rounded-sm border bg-muted ${selected ? 'border-core ring-2 ring-core' : 'border-border opacity-60 hover:opacity-100'}`}
                            title={selected ? 'Click to remove from this variant' : 'Click to use for this variant'}
                          >
                            <img src={imageUrl(img)} alt="" className="size-full object-cover" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 border-t border-border pt-3 md:grid-cols-2">
                  <SwitchRow
                    checked={variant.isActive}
                    onChange={(value) => patchVariant(variant.id, { isActive: value })}
                    title="Active"
                  >
                    When off, this variant cannot be added to new purchase requests or orders. Stock already held can
                    still be sold.
                  </SwitchRow>
                  <SwitchRow
                    checked={variant.trackedShop}
                    onChange={(value) => patchVariant(variant.id, { trackedShop: value })}
                    title="Listed in shop"
                  >
                    Controls the online shop listing only. It does not affect stock.
                  </SwitchRow>
                </div>
              </section>
            )
          })}

          {/* Pricing contexts of this branch */}
          {contexts.length > 0 && (
            <section className="space-y-3 rounded-sm border border-border bg-card p-4">
              <h2 className="text-xs font-semibold">Other pricing contexts</h2>
              <p className="text-[11px] text-muted-foreground">
                Adjustments for this product, relative to the Standard selling price. They belong to this branch
                ({branchCurrency || 'branch currency'}). Leave the value empty for no product-specific adjustment.
                {previewBase !== null ? ` Previews use ${firstActive?.label} at ${fixed2(previewBase)}.` : ''}
              </p>
              {!rulesLoaded ? (
                <Note tone="warn">The current adjustments could not be loaded, so they will be left unchanged.</Note>
              ) : null}
              {contexts.map((context) => {
                const adjustment = adjustments[context.id] || { mode: 'reduction', adjustmentType: 'percentage', value: '' }
                return (
                  <div key={context.id} className="space-y-3 rounded-sm border border-border bg-muted/40 p-3">
                    <h3 className="text-xs font-semibold">{context.name}</h3>
                    <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4">
                      <div>
                        <Label className="mb-1 block text-[10px]">Mode</Label>
                        <select
                          value={adjustment.mode}
                          disabled={!rulesLoaded}
                          onChange={(e) => updateAdjustment(context.id, { mode: e.target.value })}
                          className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="reduction">Reduction</option>
                          <option value="markup">Markup</option>
                        </select>
                      </div>
                      <div>
                        <Label className="mb-1 block text-[10px]">Type</Label>
                        <select
                          value={adjustment.adjustmentType}
                          disabled={!rulesLoaded}
                          onChange={(e) => updateAdjustment(context.id, { adjustmentType: e.target.value })}
                          className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed amount</option>
                        </select>
                      </div>
                      <div>
                        <Label className="mb-1 block text-[10px]">Value</Label>
                        <Input
                          type="number" step="0.01" min="0" placeholder="0.00"
                          disabled={!rulesLoaded}
                          value={adjustment.value}
                          onChange={(e) => updateAdjustment(context.id, { value: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-[10px]">Preview</Label>
                        <Input readOnly value={previewFor(adjustment)} placeholder="-" className="h-8 cursor-not-allowed bg-neutral-100 text-xs" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </div>
      )}

      {/* ------------------------------ INVENTORY ------------------------------ */}
      {activeTab === 'inventory' && !isService && (
        <div className="space-y-4">
          <Note>
            Stock rows are created when goods are first received, not when a variant is created. Stocked goods can be
            turned off only when no branch holds any stock of that variant, and batch tracking can be changed only while
            the variant has no stock.
          </Note>

          {variants.map((variant) => {
            const lockTracking = variant.tracked && variant.holdsStock
            const lockBatch = variant.holdsStock
            const batchOn = variant.tracked && variant.trackingMode === 'batch'
            return (
              <section key={variant.id} className="space-y-4 rounded-sm border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{variant.label}</p>
                    <p className="text-[10px] text-muted-foreground">SKU: {variant.sku || '—'}</p>
                  </div>
                  {variant.tracked ? (
                    <Link
                      href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/stock/${variant.id}`}
                      className="text-[10px] text-core hover:underline"
                    >
                      View stock
                    </Link>
                  ) : null}
                </div>

                <SwitchRow
                  checked={variant.tracked}
                  disabled={lockTracking}
                  onChange={(value) => patchVariant(variant.id, {
                    tracked: value,
                    ...(value ? {} : { trackingMode: 'none', requiresExpiry: false, shelfLife: '' }),
                  })}
                  title="Stocked goods"
                >
                  {variant.tracked
                    ? 'Stock is counted for this variant. Off means it is a service-like item with no stock.'
                    : 'No stock is kept for this variant. It can still be purchased, but receiving it adds nothing to inventory.'}
                </SwitchRow>
                {lockTracking ? (
                  <Note tone="warn">
                    At least one branch still holds stock of this variant, so stocked goods cannot be turned off. Sell,
                    adjust or return it down to zero everywhere first.
                  </Note>
                ) : null}

                {variant.tracked ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <SwitchRow
                      checked={batchOn}
                      disabled={lockBatch}
                      onChange={(value) => patchVariant(variant.id, {
                        trackingMode: value ? 'batch' : 'none',
                        ...(value ? {} : { requiresExpiry: false, shelfLife: '' }),
                      })}
                      title="Track by batch"
                    >
                      Every delivery is recorded as a batch (batch number and optional expiry date).
                    </SwitchRow>
                    {lockBatch ? (
                      <Note tone="warn">
                        {variant.holdsBatchStock
                          ? 'Batches still hold stock, so batch tracking cannot be turned off.'
                          : 'This variant holds stock, so batch tracking cannot be turned on.'}{' '}
                        It can be changed once stock is zero in every branch.
                      </Note>
                    ) : null}

                    {batchOn ? (
                      <div className="ml-12 space-y-3">
                        <SwitchRow
                          checked={variant.requiresExpiry}
                          onChange={(value) => patchVariant(variant.id, { requiresExpiry: value, ...(value ? {} : { shelfLife: '' }) })}
                          title="Items expire"
                        >
                          An expiry date is then required on every batch received.
                        </SwitchRow>
                        {variant.requiresExpiry ? (
                          <div className="max-w-[200px]">
                            <FieldLabel optional>Shelf life (days)</FieldLabel>
                            <Input
                              type="number" min="1" placeholder="e.g. 180"
                              value={variant.shelfLife}
                              onChange={(e) => patchVariant(variant.id, { shelfLife: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}

      {/* ------------------------------ ACTIONS ------------------------------ */}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-sm text-xs"
          onClick={() => router.push(detailPath)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-sm bg-core text-xs text-white"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

// The stock flags are read-only information loaded from the server; they
// must not make the form look "changed".
function stripFlags(variants) {
  return variants.map(({ holdsStock, holdsBatchStock, ...rest }) => rest)
}
