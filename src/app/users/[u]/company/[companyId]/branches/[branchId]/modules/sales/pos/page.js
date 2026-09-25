'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, ScanLine, Plus, Minus, X, User, Banknote, CreditCard, Landmark,
  ShoppingCart, ReceiptText, Trash2,
} from 'lucide-react'
import { DUMMY_PRODUCTS, DUMMY_CUSTOMERS, formatNaira } from '@/components/modules/sales/dummy-data'

const VAT_RATE = 0.075

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'transfer', label: 'Bank Transfer', icon: Landmark },
]

const emptyOrder = (label) => ({
  id: crypto.randomUUID(),
  label,
  cart: [],
  customerId: '',
  discountType: 'amount',
  discountValue: 0,
  applyVat: false,
  paymentMethod: 'cash',
  amountTendered: '',
})

export default function POSPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [orders, setOrders] = useState([emptyOrder('Sale 1')])
  const [activeOrderId, setActiveOrderId] = useState(orders[0].id)
  const [checkingOut, setCheckingOut] = useState(false)

  const activeOrder = orders.find((order) => order.id === activeOrderId)

  const updateActiveOrder = (patch) => {
    setOrders((current) => current.map((order) => (order.id === activeOrderId ? { ...order, ...patch } : order)))
  }

  const categories = useMemo(() => {
    const set = new Set(DUMMY_PRODUCTS.map((product) => product.category || 'General'))
    return ['All', ...Array.from(set)]
  }, [])

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return DUMMY_PRODUCTS.filter((product) => {
      const matchesCategory = activeCategory === 'All' || (product.category || 'General') === activeCategory
      const matchesQuery = !term
        || product.name.toLowerCase().includes(term)
        || (product.sku || '').toLowerCase().includes(term)
        || (product.barcode || '').toLowerCase().includes(term)
      return matchesCategory && matchesQuery
    })
  }, [query, activeCategory])

  const addToCart = (product) => {
    updateActiveOrder({
      cart: (() => {
        const existing = activeOrder.cart.find((item) => item.productId === product.id)
        if (existing) {
          return activeOrder.cart.map((item) =>
            item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        }
        return [...activeOrder.cart, { productId: product.id, name: product.name, unitPrice: product.unitPrice, qty: 1, stock: product.stock }]
      })(),
    })
  }

  const updateQty = (productId, qty) => {
    updateActiveOrder({
      cart: activeOrder.cart.map((item) => (item.productId === productId ? { ...item, qty: Math.max(1, qty) } : item)),
    })
  }

  const removeFromCart = (productId) => {
    updateActiveOrder({ cart: activeOrder.cart.filter((item) => item.productId !== productId) })
  }

  const clearCart = () => updateActiveOrder({ cart: [] })

  const subtotal = activeOrder.cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const discountAmount = activeOrder.discountType === 'percentage'
    ? subtotal * Math.min(100, Math.max(0, Number(activeOrder.discountValue || 0))) / 100
    : Math.min(subtotal, Math.max(0, Number(activeOrder.discountValue || 0)))
  const taxable = Math.max(0, subtotal - discountAmount)
  const vatAmount = activeOrder.applyVat ? taxable * VAT_RATE : 0
  const total = taxable + vatAmount
  const tendered = Number(activeOrder.amountTendered || 0)
  const changeDue = activeOrder.paymentMethod === 'cash' ? Math.max(0, tendered - total) : 0
  const insufficientCash = activeOrder.paymentMethod === 'cash' && tendered > 0 && tendered < total

  const addOrder = () => {
    const next = emptyOrder(`Sale ${orders.length + 1}`)
    setOrders((current) => [...current, next])
    setActiveOrderId(next.id)
  }

  const closeOrder = (orderId, event) => {
    event.stopPropagation()
    setOrders((current) => {
      const remaining = current.filter((order) => order.id !== orderId)
      const next = remaining.length ? remaining : [emptyOrder('Sale 1')]
      if (orderId === activeOrderId) setActiveOrderId(next[0].id)
      return next
    })
  }

  const checkout = async () => {
    setCheckingOut(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setCheckingOut(false)
    closeOrder(activeOrderId, { stopPropagation: () => {} })
    router.push(`${base}/pos/history`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Held-order tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => setActiveOrderId(order.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              order.id === activeOrderId
                ? 'border-core bg-core text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {order.label}
            {order.cart.length > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${order.id === activeOrderId ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                {order.cart.reduce((sum, item) => sum + item.qty, 0)}
              </span>
            )}
            {orders.length > 1 && (
              <X
                className="size-3 opacity-60 hover:opacity-100"
                onClick={(event) => closeOrder(order.id, event)}
              />
            )}
          </button>
        ))}
        <button
          onClick={addOrder}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-core hover:text-core"
        >
          <Plus className="size-3.5" /> Hold &amp; new sale
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Product side */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Scan barcode or search product, SKU..."
              className="h-11 pl-10 pr-10 text-sm"
              autoFocus
            />
            <ScanLine className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-300" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === category
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                <ShoppingCart className="size-8" />
                <p className="text-sm">No products match "{query}".</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const outOfStock = Number(product.stock) <= 0
                  return (
                    <button
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      disabled={outOfStock}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                        outOfStock
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                          : 'border-gray-200 bg-white hover:border-core hover:shadow-sm'
                      }`}
                    >
                      <div className="mb-2 flex h-16 w-full items-center justify-center rounded-md bg-gray-50 text-[10px] font-medium uppercase text-gray-300">
                        {product.name.slice(0, 2)}
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold text-gray-900">{product.name}</p>
                      <p className="mt-1 text-xs font-bold text-core">{formatNaira(product.unitPrice)}</p>
                      <p className={`mt-0.5 text-[10px] ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                        {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart / checkout side */}
        <aside className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-gray-400" />
              <h2 className="text-xs font-semibold uppercase text-gray-500">{activeOrder.label}</h2>
            </div>
            {activeOrder.cart.length > 0 && (
              <button onClick={clearCart} className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:underline">
                <Trash2 className="size-3" /> Clear
              </button>
            )}
          </div>

          <div className="border-b border-gray-100 px-4 py-2.5">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <User className="size-3.5 text-gray-400" />
              <Select
                value={activeOrder.customerId || 'walkin'}
                onValueChange={(value) => updateActiveOrder({ customerId: value === 'walkin' ? '' : value })}
              >
                <SelectTrigger className="h-8 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in customer</SelectItem>
                  {DUMMY_CUSTOMERS.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {activeOrder.cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-gray-300">
                <ShoppingCart className="size-8" />
                <p className="text-xs text-gray-400">Tap a product to add it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activeOrder.cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-800">{item.name}</p>
                      <p className="text-[11px] text-gray-500">{formatNaira(item.unitPrice)} each</p>
                    </div>
                    <div className="flex h-7 items-stretch overflow-hidden rounded border border-gray-200">
                      <button
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                        className="flex w-6 items-center justify-center text-gray-500 hover:bg-gray-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(event) => updateQty(item.productId, Number(event.target.value) || 1)}
                        className="w-8 border-x border-gray-200 text-center text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                        className="flex w-6 items-center justify-center text-gray-500 hover:bg-gray-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <p className="w-16 shrink-0 text-right text-xs font-semibold text-gray-800">
                      {formatNaira(item.qty * item.unitPrice)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="shrink-0 text-gray-300 hover:text-red-500"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeOrder.cart.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Select
                  value={activeOrder.discountType}
                  onValueChange={(value) => updateActiveOrder({ discountType: value })}
                >
                  <SelectTrigger className="h-7 w-20 px-2 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">₦ off</SelectItem>
                    <SelectItem value="percentage">% off</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  value={activeOrder.discountValue}
                  onChange={(event) => updateActiveOrder({ discountValue: Number(event.target.value) })}
                  placeholder="Discount"
                  className="h-7 flex-1 px-2 text-[11px]"
                />
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={activeOrder.applyVat}
                    onChange={(event) => updateActiveOrder({ applyVat: event.target.checked })}
                    className="size-3 rounded border-gray-300 text-core focus:ring-core"
                  />
                  VAT
                </label>
              </div>

              <div className="space-y-1 text-[11px] text-gray-500">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-medium text-gray-700">{formatNaira(subtotal)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-medium text-gray-700">-{formatNaira(discountAmount)}</span></div>}
                {activeOrder.applyVat && <div className="flex justify-between"><span>VAT (7.5%)</span><span className="font-medium text-gray-700">+{formatNaira(vatAmount)}</span></div>}
              </div>
              <div className="flex items-baseline justify-between border-t border-dashed border-gray-200 pt-2">
                <span className="text-xs font-semibold text-gray-800">Total</span>
                <strong className="text-xl font-bold tracking-tight text-slate-900">{formatNaira(total)}</strong>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => updateActiveOrder({ paymentMethod: value, amountTendered: '' })}
                    className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] font-semibold transition ${
                      activeOrder.paymentMethod === value
                        ? 'border-core bg-core/5 text-core'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              {activeOrder.paymentMethod === 'cash' && (
                <div className="space-y-1.5 rounded-md bg-gray-50 p-2.5">
                  <label className="flex items-center justify-between text-[11px] font-medium text-gray-600">
                    Cash tendered
                    <Input
                      type="number"
                      min="0"
                      value={activeOrder.amountTendered}
                      onChange={(event) => updateActiveOrder({ amountTendered: event.target.value })}
                      placeholder="0"
                      className="h-7 w-28 px-2 text-right text-xs"
                    />
                  </label>
                  {tendered > 0 && (
                    <div className={`flex justify-between text-[11px] font-semibold ${insufficientCash ? 'text-red-500' : 'text-emerald-600'}`}>
                      <span>{insufficientCash ? 'Amount short' : 'Change due'}</span>
                      <span>{insufficientCash ? formatNaira(total - tendered) : formatNaira(changeDue)}</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-core text-white"
                disabled={checkingOut || insufficientCash}
                onClick={checkout}
              >
                {checkingOut ? 'Processing...' : `Charge ${formatNaira(total)}`}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}