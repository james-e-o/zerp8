'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Banknote, CreditCard, ImageIcon, Landmark, Minus, PauseCircle, Plus, ScanLine, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { CompanyInfoContext } from '@/app/users/[u]/company/[companyId]/companyInfoProvider'
import { StaffContext } from '@/components/contexts/staff-context'
import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CustomerPicker from '@/components/modules/sales/customer-picker'
import ReceiptDialog from '@/components/modules/sales/pos-receipt'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'
import { computeTotals, getLineTotal, useMoney, useSalesSettings } from '@/components/modules/sales/quotation-shared'
import { allocatePayments, formatDateTime, useBranchTimezone, usePosSetup } from '@/components/modules/sales/pos-shared'

const KIND_ICON = { cash: Banknote, card: CreditCard, transfer: Landmark }

// The product image, whichever field the catalog carries it in. No image shows a placeholder.
const firstUrl = (list) => {
  if (!Array.isArray(list) || !list.length) return ''
  const primary = list.find((i) => i?.is_primary) || list[0]
  return typeof primary === 'string' ? primary : primary?.url || ''
}
const imageOf = (v) => firstUrl(v?.images) || v?.productThumbnail || firstUrl(v?.productImages) || v?.image_url || ''

function ItemImage({ src, className = '' }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="h-1/3 w-1/3 opacity-50" />
      )}
    </div>
  )
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const blankTab = (n) => ({ id: uid(), name: `Sale ${n}`, lines: [], customer: '', applyVat: true, ref: uid(), search: '', category: '' })

export default function PosSellPage() {
  const { u, companyId, branchId } = useParams()
  const { info } = useContext(CompanyInfoContext)
  const { branchStaffData = [], error: staffError } = useContext(StaffContext) || {}
  const router = useRouter()
  const money = useMoney()
  const tz = useBranchTimezone(branchId)
  const pos = usePosSetup(branchId)
  const { settings: salesSettings } = useSalesSettings(branchId)
  const { catalog, pricingRules, defaultContext, loading: catalogLoading, error: catalogError } = useQuotationCatalog(branchId)
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/pos`

  const session = pos.mySession
  const till = pos.tills.find((t) => t.id === session?.till) || null
  const warehouse = till?.warehouse || null
  const assignedCashiers = useMemo(() => {
    const staffOptions = branchStaffData
      .filter((staff) => staff.user)
      .map((staff) => ({
        userId: staff.user,
        label: staff.first_name || staff.name || staff.email || 'Unnamed',
      }))
    const ownerOption = info?.owner
      ? [{ userId: info.owner, label: 'Owner' }]
      : []
    const seenUsers = new Set(ownerOption.map((person) => person.userId))

    return [
      ...ownerOption,
      ...staffOptions.filter((person) => {
        if (seenUsers.has(person.userId)) return false
        seenUsers.add(person.userId)
        return true
      }),
    ]
  }, [branchStaffData, info?.owner])

  // ----- open-session panel -----
  const [tillChoice, setTillChoice] = useState('')
  const [floatValue, setFloatValue] = useState('')
  const [assignedUser, setAssignedUser] = useState('')
  const [opening, setOpening] = useState(false)
  const busyTills = new Set(pos.openSessions.map((s) => s.till))
  const freeTills = pos.tills.filter((t) => !busyTills.has(t.id))

  useEffect(() => {
    if (!tillChoice && freeTills.length) setTillChoice(freeTills[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.tills, pos.openSessions])

  useEffect(() => {
    let cancelled = false
    if (!tillChoice) return undefined
    const loadSuggestedFloat = async () => {
      try {
        const { data, error } = await supabase.rpc('pos_suggested_float', { p_till: tillChoice })
        if (cancelled) return
        if (error) throw error
        setFloatValue(String(Number(data || 0)))
      } catch (error) {
        if (cancelled) return
        console.error('Suggested float failed:', error)
        toast.error(error?.message || 'Could not load the suggested opening float.')
      }
    }
    loadSuggestedFloat()
    return () => { cancelled = true }
  }, [tillChoice])

  useEffect(() => {
    if (!staffError) return
    console.error('Branch staff failed to load:', staffError)
    toast.error(`Could not load branch cashiers: ${staffError}`)
  }, [staffError])

  const openSession = async () => {
    setOpening(true)
    try {
      const { data, error } = await supabase.rpc('pos_open_session', { p_till: tillChoice, p_float: Number(floatValue || 0) })
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Could not open the session.')
      }
      toast.success(`Session ${data.session_number} opened.`)
      pos.reload()
    } catch (error) {
      const message = error?.message || 'Could not open the session.'
      console.error('Open session failed:', message)
      toast.error(message)
    } finally {
      setOpening(false)
    }
  }

  // ----- create a cash till (managers) -----
  const [tillFormOpen, setTillFormOpen] = useState(false)
  const [newTillName, setNewTillName] = useState('')
  const [newTillWarehouse, setNewTillWarehouse] = useState('')
  const [branchWarehouses, setBranchWarehouses] = useState([])
  const [creatingTill, setCreatingTill] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!branchId) return undefined
    const loadWarehouses = async () => {
      try {
        const { data, error } = await supabase.from('warehouses').select('id, name, is_default').eq('home_branch', branchId).is('archived_at', null).order('is_default', { ascending: false })
        if (cancelled) return
        if (error) throw error
        setBranchWarehouses(data || [])
        if (data?.length) setNewTillWarehouse((w) => w || data[0].id)
      } catch (error) {
        if (cancelled) return
        console.error('Warehouses failed to load:', error)
        toast.error(error?.message || 'Could not load warehouses.')
      }
    }
    loadWarehouses()
    return () => { cancelled = true }
  }, [branchId])

  const createTill = async () => {
    setCreatingTill(true)
    try {
      const { data, error } = await supabase.rpc('pos_create_till', {
        p_branch: branchId,
        p_name: newTillName,
        p_warehouse: newTillWarehouse,
        p_assigned_user: assignedUser || null,
      })
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Could not create the cash till.')
      }
      toast.success('Cash till created.')
      setNewTillName('')
      setAssignedUser('')
      setTillFormOpen(false)
      setTillChoice(data.till)
      pos.reload()
    } catch (error) {
      const message = error?.message || 'Could not create the cash till.'
      console.error('Create cash till failed:', message)
      toast.error(message)
    } finally {
      setCreatingTill(false)
    }
  }

  // ----- sale tabs: several customers at once on one till -----
  // Tabs live in the browser (kept for this session if the page is reloaded). "Hold" is what
  // saves a basket to the database.
  const [tabs, setTabs] = useState(() => [blankTab(1)])
  const [activeId, setActiveId] = useState(null)
  const tabCounter = useRef(1)
  const active = tabs.find((t) => t.id === activeId) || tabs[0]
  const lines = active.lines
  const customer = active.customer
  const applyVat = active.applyVat

  const patchActive = (patch) => setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)))
  const setLines = (fn) => patchActive((t) => ({ lines: typeof fn === 'function' ? fn(t.lines) : fn }))
  const setCustomer = (value) => patchActive({ customer: value })
  const setApplyVat = (value) => patchActive({ applyVat: value })
  // Each sale tab has its own search and category, like a separate checkout.
  const search = active.search || ''
  const category = active.category || ''
  const setSearch = (value) => patchActive((t) => ({ search: typeof value === 'function' ? value(t.search || '') : value }))
  const setCategory = (value) => patchActive((t) => ({ category: typeof value === 'function' ? value(t.category || '') : value }))

  useEffect(() => {
    if (!session?.id) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(`pos-tabs-${session.id}`) || 'null')
      if (saved?.tabs?.length) {
        setTabs(saved.tabs)
        setActiveId(saved.activeId || saved.tabs[0].id)
        tabCounter.current = saved.counter || saved.tabs.length
      }
    } catch { /* storage unavailable: start with one empty tab */ }
  }, [session?.id])
  useEffect(() => {
    if (!session?.id) return
    try { sessionStorage.setItem(`pos-tabs-${session.id}`, JSON.stringify({ tabs, activeId: active.id, counter: tabCounter.current })) } catch { /* ignore */ }
  }, [tabs, active.id, session?.id])

  const addTab = () => {
    tabCounter.current += 1
    const tab = blankTab(tabCounter.current)
    setTabs((ts) => [...ts, tab])
    setActiveId(tab.id)
  }
  const closeTab = (tab) => {
    if (tab.lines.length) { toast.error('Hold or clear this sale before closing its tab.'); return }
    if (tabs.length === 1) return
    const rest = tabs.filter((t) => t.id !== tab.id)
    setTabs(rest)
    if (active.id === tab.id) setActiveId(rest[0].id)
  }
  // After a sale or a hold: the tab goes away if others are open, otherwise it is emptied.
  const finishTab = () => {
    if (tabs.length > 1) {
      const rest = tabs.filter((t) => t.id !== active.id)
      setTabs(rest)
      setActiveId(rest[0].id)
    } else {
      patchActive({ lines: [], customer: '', applyVat: true, ref: uid(), search: '', category: '' })
    }
  }

  // ----- catalog, categories -----
  const [categoryByProduct, setCategoryByProduct] = useState({})
  const [categories, setCategories] = useState([])
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [p, c] = await Promise.all([
        supabase.from('products').select('id, category').eq('status', 'active'),
        supabase.from('categories').select('id, name').order('name'),
      ])
      if (cancelled) return
      if (p.error || c.error) { console.warn('Categories could not be loaded:', p.error || c.error); return }
      setCategoryByProduct(Object.fromEntries((p.data || []).map((r) => [r.id, r.category])))
      setCategories(c.data || [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Recent: what this branch sold most over the last 30 days, plus what was added on this screen.
  const [soldBefore, setSoldBefore] = useState([])
  const [addedNow, setAddedNow] = useState([])
  useEffect(() => {
    let cancelled = false
    if (!branchId || !session?.id) return undefined
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const loadRecent = async () => {
      try {
        const { data, error } = await supabase
          .from('pos_sale_lines')
          .select('variant, quantity, pos_sales!inner(branch, created_at)')
          .eq('pos_sales.branch', branchId)
          .gte('pos_sales.created_at', since)
          .limit(2000)
        if (cancelled) return
        if (error) throw error
        const totals = {}
        ;(data || []).forEach((r) => { totals[r.variant] = (totals[r.variant] || 0) + Number(r.quantity || 0) })
        setSoldBefore(Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([id]) => id))
      } catch (error) {
        if (cancelled) return
        console.error('Recent items failed to load:', error)
        toast.error(error?.message || 'Could not load recent items.')
      }
    }
    loadRecent()
    return () => { cancelled = true }
  }, [branchId, session?.id])
  const recentIds = useMemo(() => [...new Set([...addedNow, ...soldBefore])].slice(0, 12), [addedNow, soldBefore])

  const [soldNow, setSoldNow] = useState({}) // variant -> qty sold on this screen since it loaded
  const [flash, setFlash] = useState('')
  const searchRef = useRef(null)

  const stockOf = (v) => {
    if (!v.is_tracked_inventory) return Infinity
    const free = Number(v.stockByWarehouse?.[warehouse] || 0) - Number(soldNow[v.id] || 0)
    return Math.max(0, free)
  }
  // Two decimals, the same as the database, so the totals on both sides agree.
  const priceOf = (v, qty = 1) => Math.round(Number(resolveQuotationPrice(v, defaultContext?.id, pricingRules, qty)) * 100) / 100

  // Who may alter prices / give discounts (new permission). Without it the discount boxes are locked.
  const [canEditPrice, setCanEditPrice] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!branchId) return undefined
    const loadPermission = async () => {
      try {
        const { data, error } = await supabase.rpc('can_alter_sales_price', { p_branch: branchId })
        if (cancelled) return
        if (error) throw error
        setCanEditPrice(Boolean(data))
      } catch (error) {
        if (cancelled) return
        console.error('Price permission check failed:', error)
        toast.error(error?.message || 'Could not check the discount permission.')
      }
    }
    loadPermission()
    return () => { cancelled = true }
  }, [branchId])

  // Nothing is listed until the cashier searches or picks a category.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q && !category) return []
    if (category === 'recent' && !q) return recentIds.map((id) => catalog.find((v) => v.id === id)).filter(Boolean)
    return catalog.filter((v) => {
      if (category && category !== 'recent' && categoryByProduct[v.productId] !== category) return false
      if (!q) return true
      return [v.displayName, v.sku, v.barcode, v.ean, v.upc].some((x) => String(x || '').toLowerCase().includes(q))
    })
  }, [catalog, search, category, categoryByProduct, recentIds])

  const vatRate = Number(salesSettings.default_vat_rate || 0)
  const maxDiscount = Number(pos.settings?.max_discount_percent ?? 100)
  const items = lines.map((l) => ({ qty: l.qty, unitPrice: l.price, discountType: 'percentage', discountValue: l.discount }))
  const totals = computeTotals(items, 'amount', 0, applyVat, vatRate)
  const total = Math.round(totals.total * 100) / 100

  const addVariant = (v) => {
    const available = stockOf(v)
    if (available <= 0) {
      toast.error(`${v.displayName} is out of stock.`)
      setFlash(v.id)
      setTimeout(() => setFlash(''), 500)
      return
    }
    setAddedNow((prev) => [v.id, ...prev.filter((id) => id !== v.id)].slice(0, 12))
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.id)
      if (existing) {
        if (existing.qty + 1 > available) { toast.error(`Only ${available} of ${v.displayName} in stock.`); return prev }
        return prev.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { variantId: v.id, name: v.displayName, sku: v.sku, image: imageOf(v), price: priceOf(v, 1), qty: 1, discount: 0, max: available }]
    })
  }

  const setQty = (variantId, qty) => {
    setLines((prev) => prev.map((l) => {
      if (l.variantId !== variantId) return l
      const next = Math.max(0, Number(qty) || 0)
      if (next > l.max) { toast.error(`Only ${l.max} of ${l.name} in stock.`); return { ...l, qty: l.max } }
      return { ...l, qty: next }
    }).filter((l) => l.qty > 0))
  }
  const setDiscount = (variantId, value) => {
    if (!canEditPrice) { toast.error('You do not have permission to give discounts.'); return }
    const n = Math.max(0, Number(value) || 0)
    if (n > maxDiscount) toast.error(`Discounts are limited to ${maxDiscount}% at this branch.`)
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, discount: Math.min(n, maxDiscount) } : l)))
  }

  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return
    const code = search.trim().toLowerCase()
    if (!code) return
    const exact = catalog.find((v) => [v.barcode, v.ean, v.upc, v.sku].some((x) => x && String(x).toLowerCase() === code))
    if (exact) { addVariant(exact); setSearch('') }
    else if (visible.length === 1) { addVariant(visible[0]); setSearch('') }
    else toast.error('No single product matches that code.')
  }

  const clearBasket = () => patchActive({ lines: [], customer: '', applyVat: true, ref: uid(), search: '', category: '' })

  // ----- held baskets -----
  const [held, setHeld] = useState([])
  const [heldOpen, setHeldOpen] = useState(false)
  const loadHeld = async () => {
    const { data, error } = await supabase.from('pos_held_sales').select('id, label, payload, created_at').eq('branch', branchId).order('created_at', { ascending: false })
    if (error) { console.error('Held sales failed to load:', error); toast.error(error.message || 'Could not load held sales.'); return }
    setHeld(data || [])
  }
  useEffect(() => { if (session) loadHeld() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session?.id])

  const holdBasket = async () => {
    if (!lines.length) return
    const payload = { lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, discount: l.discount })), customer, applyVat }
    const label = lines.map((l) => l.name).slice(0, 2).join(', ')
    const { data, error } = await supabase.rpc('pos_hold_sale', { p_branch: branchId, p_label: label, p_payload: { ...payload, lines: payload.lines } })
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not hold the sale.'
      console.error('Hold failed:', message); toast.error(message); return
    }
    toast.success('Sale put on hold.')
    finishTab(); loadHeld()
  }

  const resumeHeld = async (h) => {
    const rebuilt = []
    let skipped = 0
    for (const l of h.payload?.lines || []) {
      const v = catalog.find((x) => x.id === l.variantId)
      const available = v ? stockOf(v) : 0
      if (!v || available <= 0) { skipped += 1; continue }
      const qty = Math.min(Number(l.qty || 1), available)
      rebuilt.push({ variantId: v.id, name: v.displayName, sku: v.sku, image: imageOf(v), price: priceOf(v, qty), qty, discount: Math.min(Number(l.discount || 0), maxDiscount), max: available })
    }
    if (!rebuilt.length) { toast.error('None of the items on that sale are available any more.'); return }
    if (lines.length) {
      tabCounter.current += 1
      const tab = { ...blankTab(tabCounter.current), lines: rebuilt, customer: h.payload?.customer || '', applyVat: h.payload?.applyVat !== false }
      setTabs((ts) => [...ts, tab])
      setActiveId(tab.id)
    } else {
      patchActive({ lines: rebuilt, customer: h.payload?.customer || '', applyVat: h.payload?.applyVat !== false })
    }
    if (skipped) toast.error(`${skipped} item(s) were left out because they are out of stock. Prices are today's prices.`)
    const { data, error } = await supabase.rpc('pos_discard_held', { p_id: h.id })
    if (error || data?.success === false) console.warn('Held sale could not be cleared:', error || data?.error)
    setHeldOpen(false); loadHeld()
  }

  const discardHeld = async (h) => {
    const { data, error } = await supabase.rpc('pos_discard_held', { p_id: h.id })
    if (error || data?.success === false) { const m = error?.message || data?.error || 'Could not discard.'; console.error(m); toast.error(m); return }
    toast.success('Held sale discarded.'); loadHeld()
  }

  // ----- payment -----
  const [payOpen, setPayOpen] = useState(false)
  const [payRows, setPayRows] = useState([])
  const [paying, setPaying] = useState(false)
  const [receiptId, setReceiptId] = useState('')
  const alloc = allocatePayments(payRows, pos.methods, total)

  const openPay = () => {
    if (!lines.length) return
    const cash = pos.methods.find((m) => m.kind === 'cash') || pos.methods[0]
    setPayRows(cash ? [{ id: 1, methodId: cash.id, value: '', reference: '' }] : [])
    setPayOpen(true)
  }
  const addPayRow = (m) => {
    const remaining = alloc.remaining
    setPayRows((rows) => [...rows, { id: Date.now(), methodId: m.id, value: m.kind === 'cash' ? '' : String(Math.max(remaining, 0)), reference: '' }])
  }
  const updateRow = (id, patch) => setPayRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const completeSale = async () => {
    if (paying || !alloc.valid) return
    setPaying(true)
    const { data, error } = await supabase.rpc('pos_complete_sale', {
      p_session: session.id,
      p_client_ref: active.ref,
      p_header: { customer: customer || null, apply_vat: applyVat },
      p_lines: lines.map((l) => ({ variant: l.variantId, quantity: l.qty, unit_price: l.price, discount_value: l.discount, description_snapshot: l.name })),
      p_payments: alloc.rows.map((r) => ({ method: r.methodId, amount: r.applied, tendered: r.tendered, reference: r.reference || null })),
    })
    setPaying(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'The sale could not be completed.'
      console.error('Sale failed:', message)
      toast.error(message)
      return
    }
    toast.success(`${data.sale_number} complete.${Number(data.change) > 0 ? ` Change: ${money(data.change)}` : ''}`)
    setSoldNow((prev) => {
      const next = { ...prev }
      lines.forEach((l) => { next[l.variantId] = (next[l.variantId] || 0) + l.qty })
      return next
    })
    setPayOpen(false)
    setReceiptId(data.sale)
    finishTab()
  }

  // ----- cash in / out -----
  const [cashOpen, setCashOpen] = useState(false)
  const [cashKind, setCashKind] = useState('cash_out')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')
  const [cashBusy, setCashBusy] = useState(false)
  const submitCash = async () => {
    setCashBusy(true)
    const { data, error } = await supabase.rpc('pos_cash_move', { p_session: session.id, p_kind: cashKind, p_amount: Number(cashAmount || 0), p_reason: cashReason })
    setCashBusy(false)
    if (error || !data?.success) { const m = error?.message || data?.error || 'Could not record the cash movement.'; console.error(m); toast.error(m); return }
    toast.success(cashKind === 'cash_in' ? 'Cash added to the drawer.' : 'Cash taken from the drawer.')
    setCashOpen(false); setCashAmount(''); setCashReason('')
  }

  // ===================== render =====================
  if (pos.loading) return <div className="p-6 text-sm text-muted-foreground">Loading POS...</div>

  if (!session) {
    const allBusy = pos.tills.length > 0 && freeTills.length === 0
    const tillForm = (
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-medium">New cash till</p>
        <Input placeholder="Cash till name" value={newTillName} onChange={(e) => setNewTillName(e.target.value)} className="text-xs" />
        <select value={newTillWarehouse} onChange={(e) => setNewTillWarehouse(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
          {branchWarehouses.length === 0 && <option value="">No warehouse on this branch</option>}
          {branchWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="block text-xs font-medium">Assigned cashier (optional)
          <select value={assignedUser} onChange={(e) => setAssignedUser(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
            <option value="">Anyone with POS access</option>
            {assignedCashiers.map((person) => <option key={person.userId} value={person.userId}>{person.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">This cash till sells stock from the warehouse you choose.</p>
        <Button className="w-full bg-core text-xs text-white hover:bg-core/90" disabled={creatingTill || !newTillName.trim() || !newTillWarehouse} onClick={createTill}>{creatingTill ? 'Creating...' : 'Create cash till'}</Button>
      </div>
    )
    return (
      <div className="h-full overflow-y-auto py-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-5">
          {pos.tills.length === 0 ? (
            <>
              <div>
                <h2 className="text-sm font-semibold">Create a cash till</h2>
                <p className="text-xs text-muted-foreground">This branch has no cash till yet. A manager needs to create one before anyone can sell.</p>
              </div>
              {tillForm}
            </>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-semibold">Open a session on a cash till</h2>
                <p className="text-xs text-muted-foreground">A session is one trading period on a cash till.</p>
                <p className="text-xs text-muted-foreground">Choose your cash till and count the cash already in the drawer. You cannot sell until a session is open.</p>
              </div>
              {allBusy ? (
                <p className="text-xs text-muted-foreground">Every cash till already has an open session. Close one from the Sessions page, or ask a manager to add a cash till.</p>
              ) : (
                <>
                  <label className="block text-xs font-medium">Cash till
                    <select value={tillChoice} onChange={(e) => setTillChoice(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
                      {freeTills.map((t) => <option key={t.id} value={t.id}>{t.name}{t.assigned_label ? ` · ${t.assigned_label}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-medium">Opening float (cash in the drawer)
                    <Input type="number" min="0" step="0.01" value={floatValue} onChange={(e) => setFloatValue(e.target.value)} className="mt-1 text-xs" />
                  </label>
                  <Button className="w-full bg-core text-xs text-white hover:bg-core/90" disabled={opening || !tillChoice} onClick={openSession}>{opening ? 'Opening...' : 'Open session'}</Button>
                </>
              )}
              <Button type="button" variant="link" className="h-auto p-0 text-xs text-core hover:text-core/80" onClick={() => setTillFormOpen((o) => !o)}>{tillFormOpen ? 'Hide' : 'Add another cash till (manager)'}</Button>
              {tillFormOpen && tillForm}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-1 pb-1">
      {/* session strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
        <span>
          <span className="font-semibold">{till?.name}</span> · {session.session_number} · opened {formatDateTime(session.opened_at, tz)}
        </span>
        <span className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHeldOpen(true)}>Held ({held.length})</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCashOpen(true)}>Cash in / out</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`${base}/sessions/${session.id}`)}>Close session</Button>
        </span>
      </div>

      {/* sale tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <div key={t.id} className={`flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${t.id === active.id ? 'border-core bg-core text-white' : 'border-border bg-card hover:bg-muted'}`}>
            <button type="button" onClick={() => setActiveId(t.id)} className="font-medium">
              {t.name}{t.lines.length ? ` · ${t.lines.reduce((n, l) => n + l.qty, 0)}` : ''}
            </button>
            {tabs.length > 1 && <button type="button" onClick={() => closeTab(t)} aria-label={`Close ${t.name}`}><X className="h-3 w-3" /></button>}
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={addTab}><Plus className="mr-1 h-3.5 w-3.5" />New sale</Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_380px]">
        {/* products */}
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-md border border-border bg-card p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} placeholder="Search or scan a barcode, then press Enter" className="pl-8 pr-9" autoFocus />
            <ScanLine className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          {(categories.length > 0 || recentIds.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[{ id: 'recent', name: 'Recent' }, ...categories].map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory((cur) => (cur === c.id ? '' : c.id))}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs ${category === c.id ? 'border-core bg-core text-white' : 'border-border hover:bg-muted'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {catalogLoading ? <p className="p-4 text-sm text-muted-foreground">Loading products...</p>
              : catalogError ? <p className="p-4 text-sm text-red-600 dark:text-red-400">{catalogError}</p>
              : !search.trim() && !category ? <p className="p-6 text-center text-sm text-muted-foreground">Search for a product, or choose Recent or a category, to see items.</p>
              : visible.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{category === 'recent' && !search.trim() ? 'Nothing sold or added recently.' : 'No products match.'}</p>
              : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                  {visible.map((v) => {
                    const stock = stockOf(v)
                    const out = stock <= 0
                    return (
                      <button key={v.id} type="button" onClick={() => addVariant(v)}
                        className={`flex aspect-square flex-col gap-1 rounded-md border p-1.5 text-left transition-colors ${out ? 'border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30' : 'border-border bg-background hover:border-core'} ${flash === v.id ? 'animate-pulse' : ''}`}>
                        <ItemImage src={imageOf(v)} className="min-h-0 w-full flex-1" />
                        <p className="line-clamp-1 text-xs font-medium">{v.displayName}</p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs tabular-nums">{money(priceOf(v, 1))}</span>
                          <span className={`text-[10px] ${out ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {out ? 'Out of stock' : stock === Infinity ? 'Service' : `${stock} left`}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
          </div>
        </div>

        {/* basket */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Basket</span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!lines.length} onClick={holdBasket}><PauseCircle className="mr-1 h-3.5 w-3.5" />Hold</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!lines.length} onClick={clearBasket}><X className="mr-1 h-3.5 w-3.5" />Clear</Button>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Tap a product to add it.</p> : lines.map((l) => (
              <div key={l.variantId} className="border-b border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <ItemImage src={l.image} className="h-10 w-10 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm font-medium">{l.name}</p>
                  <button type="button" onClick={() => setQty(l.variantId, 0)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.variantId, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input type="number" min="0" value={l.qty} onChange={(e) => setQty(l.variantId, e.target.value)} className="h-7 w-14 px-1 text-center" />
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" disabled={l.qty >= l.max} onClick={() => setQty(l.variantId, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">Disc %
                    <Input type="number" min="0" max={maxDiscount} value={l.discount} disabled={!canEditPrice} title={canEditPrice ? undefined : 'You need the alter-price permission to give discounts'} onChange={(e) => setDiscount(l.variantId, e.target.value)} className="h-7 w-14 px-1 text-center" />
                  </label>
                  <span className="w-20 text-right text-sm tabular-nums">{money(getLineTotal({ qty: l.qty, unitPrice: l.price, discountType: 'percentage', discountValue: l.discount }))}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border p-3">
            <CustomerPicker branchId={branchId} value={customer} onChange={setCustomer} placeholder="Walk-in customer" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} />Add VAT ({vatRate}%)</label>
            <div className="space-y-0.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              {totals.lineDiscounts > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(totals.lineDiscounts)}</span></div>}
              {applyVat && <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="tabular-nums">{money(totals.vat)}</span></div>}
              <div className="flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
            </div>
            <Button className="w-full bg-core text-white hover:bg-core/90 disabled:opacity-50" size="lg" disabled={!lines.length} onClick={openPay}>Pay {lines.length ? money(total) : ''}</Button>
          </div>
        </div>
      </div>

      {/* payment */}
      <Dialog open={payOpen} onOpenChange={(o) => { if (!paying) setPayOpen(o) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment · {money(total)}</DialogTitle>
            <DialogDescription>The sale can only be completed when the payments add up to the total.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {pos.methods.map((m) => {
              const Icon = KIND_ICON[m.kind] || Banknote
              return <Button key={m.id} type="button" size="sm" variant="outline" onClick={() => addPayRow(m)}><Icon className="mr-1.5 h-4 w-4" />{m.name}</Button>
            })}
          </div>
          <div className="space-y-2">
            {alloc.rows.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-sm font-medium">{r.method?.name}</span>
                  <Input type="number" min="0" step="0.01" autoFocus placeholder={r.method?.kind === 'cash' ? 'Cash received' : 'Amount'} value={r.value} onChange={(e) => updateRow(r.id, { value: e.target.value })} className="h-8" />
                  {r.method?.kind === 'cash' && alloc.remaining + r.applied > 0 && (
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateRow(r.id, { value: String(Math.round((alloc.remaining + r.applied) * 100) / 100) })}>Exact</Button>
                  )}
                  <button type="button" onClick={() => setPayRows((rows) => rows.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                {r.method?.kind !== 'cash' && (
                  <Input placeholder={r.method?.requires_reference ? 'Reference (required)' : 'Reference (optional)'} value={r.reference} onChange={(e) => updateRow(r.id, { reference: e.target.value })} className="mt-2 h-8" />
                )}
                {r.problem && r.value !== '' && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{r.problem}</p>}
              </div>
            ))}
          </div>
          <div className="space-y-0.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Still to pay</span><span className="font-semibold tabular-nums">{money(alloc.remaining)}</span></div>
            {alloc.change > 0 && <div className="flex justify-between text-base font-semibold"><span>Change to give</span><span className="tabular-nums">{money(alloc.change)}</span></div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={paying} onClick={() => setPayOpen(false)}>Back</Button>
            <Button type="button" className="bg-core text-white hover:bg-core/90 disabled:opacity-50" disabled={!alloc.valid || paying} onClick={completeSale}>{paying ? 'Completing...' : 'Complete sale'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* held */}
      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Held sales</DialogTitle><DialogDescription>Resume one to continue where the customer left off.</DialogDescription></DialogHeader>
          {held.length === 0 ? <p className="text-sm text-muted-foreground">Nothing on hold.</p> : (
            <div className="space-y-2">
              {held.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.label || 'Held sale'}</p>
                    <p className="text-xs text-muted-foreground">{(h.payload?.lines || []).length} item(s) · {formatDateTime(h.created_at, tz)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="bg-core text-white hover:bg-core/90" onClick={() => resumeHeld(h)}>Resume</Button>
                    <Button size="sm" variant="outline" onClick={() => discardHeld(h)}>Discard</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* cash in / out */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cash in / out</DialogTitle><DialogDescription>Record money added to or taken from the drawer.</DialogDescription></DialogHeader>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={cashKind === 'cash_out' ? 'default' : 'outline'} onClick={() => setCashKind('cash_out')}>Cash out</Button>
            <Button type="button" size="sm" variant={cashKind === 'cash_in' ? 'default' : 'outline'} onClick={() => setCashKind('cash_in')}>Cash in</Button>
          </div>
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
          <Input placeholder="Reason (required)" value={cashReason} onChange={(e) => setCashReason(e.target.value)} />
          <DialogFooter><Button className="bg-core text-white hover:bg-core/90" disabled={cashBusy} onClick={submitCash}>{cashBusy ? 'Saving...' : 'Record'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptDialog branchId={branchId} saleId={receiptId} onClose={() => { setReceiptId(''); searchRef.current?.focus() }} />
    </div>
  )
}