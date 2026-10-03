'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import PurchaseRequestLineItemsTable from '@/components/modules/purchases/purchase-request-line-items-table'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const generateRequestNumber = () => {
  const date = new Date()

  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`

  return `PR-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function PurchaseRequestForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''

  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`

  const [requestNumber, setRequestNumber] = useState('')
  const [requester, setRequester] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([
    { variantId: '', qty: 1, estimatedCostPrice: 0 },
  ])
  const [saving, setSaving] = useState(false)

  const {
    catalog,
    currencies,
    loading: catalogLoading,
    error: catalogError,
  } = useRequestCatalog(branchId)

  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const variant = catalog.find((entry) => entry.id === item.variantId)

        return (
          sum +
          Number(item.qty || 0) *
            Number(item.estimatedCostPrice || 0)
        )
      }, 0),
    [catalog, items]
  )

  const currencyMismatches = useMemo(
    () =>
      items
        .map((item) => catalog.find((entry) => entry.id === item.variantId))
        .filter((variant) => variant?.cost_currency && variant.cost_currency !== branchCurrencyCode),
    [catalog, items]
  )

  useEffect(() => {
    setRequestNumber(generateRequestNumber())
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    setSaving(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    setSaving(false)
    router.push(base)
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            New Purchase Request
          </h1>

          <p className="text-xs text-gray-500">{requestNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={'h-7 text-xs'}
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="purchase-request-form"
            className="bg-core text-white h-7 text-xs"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
        </div>
      </div>

      <form
        id="purchase-request-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 justify-between grow flex-col gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Requested by

            <Input
              required
              value={requester}
              onChange={(event) => setRequester(event.target.value)}
              placeholder="Name or team"
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Needed by

            <Input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>
        </div>

        <div className="flex flex-col grow overflow-hidden">
          {/* <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Requested items
              </h2>

              <p className="text-xs text-gray-500">
                Select existing products. Cost price and available stock are
                read from the product record.
              </p>
            </div>
          </div> */}

          {catalogError && (
            <p className="mb-2 text-xs text-red-600">{catalogError}</p>
          )}

          {catalogLoading ? (
            <p className="text-xs text-gray-500">Loading products...</p>
          ) : (
            <PurchaseRequestLineItemsTable
              items={items}
              setItems={setItems}
              catalog={catalog}
              branchCurrencyCode={branchCurrencyCode}
              branchCurrencySymbol={branchCurrencySymbol}
            />
          )}
          {currencyMismatches.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Some selected products use a different cost currency than this branch ({branchCurrencyCode || 'base currency'}).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex-1 text-xs font-medium text-gray-700">
            Notes

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reason, delivery details, or approval notes..."
              className="mt-1 min-h-20 bg-white text-xs"
            />
          </label>

          <div className="w-full max-w-xs shrink-0 sm:ml-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                Estimated total
              </span>

              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(total, branchCurrencyCode, branchCurrencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}