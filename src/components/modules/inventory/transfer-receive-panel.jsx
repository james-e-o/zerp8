'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'
import { formatQty, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { fetchBatches } from '@/components/modules/inventory/receipt-shared'

// The receiving warehouse confirms what arrived. Used by the transfer's own
// page and by the warehouse's Transfers tab, so acceptance works the same in
// both. `data` is what get_inventory_transfer returns. A warehouse cannot
// reject a transfer (the branch authorised it; only management cancels), so
// the only choices are how much of each line arrived and where it was put.
// Every result is also shown as a toast.

export default function TransferReceivePanel({ data, onDone }) {
  const lines = data?.lines || []
  const [entries, setEntries] = useState({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [batches, setBatches] = useState({})

  useEffect(() => {
    setEntries(Object.fromEntries(lines.map((line) => [line.id, { quantity: String(line.quantity ?? ''), shelf: '' }])))
  }, [data])

  const variantIds = useMemo(() => lines.map((line) => line.variant), [lines])
  const { variants } = useStockNames(variantIds, [])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(lines.map((line) => line.batch).filter(Boolean))]
    if (ids.length) {
      fetchBatches(ids).then((found) => {
        if (!cancelled) setBatches(found)
      })
    }
    return () => {
      cancelled = true
    }
  }, [lines])

  const shortage = lines.some((line) => Number(entries[line.id]?.quantity) < Number(line.quantity))

  async function confirm() {
    setBusy(true)
    const payload = lines.map((line) => ({
      line: line.id,
      quantity_received: entries[line.id]?.quantity === '' ? null : Number(entries[line.id]?.quantity),
      shelf: entries[line.id]?.shelf || null,
    }))
    const { data: result, error } = await supabase.rpc('receive_inventory_transfer', {
      p_transfer: data.transfer.id,
      p_lines: payload,
      p_note: note || null,
    })
    if (error) toast.error(error.message)
    else if (!result?.success) toast.error(result?.error || 'Could not confirm.')
    else {
      toast.success(
        result.short_lines > 0
          ? `Accepted. ${result.short_lines} line${result.short_lines === 1 ? '' : 's'} came up short and ${result.short_lines === 1 ? 'is' : 'are'} recorded as a loss.`
          : 'Accepted. The stock is now in this warehouse.'
      )
      setNote('')
      if (onDone) await onDone()
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Batch</th>
              <th className="px-3 py-2 text-right">Sent</th>
              <th className="px-3 py-2 text-right">Arrived</th>
              <th className="px-3 py-2 text-left">Put on shelf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line) => {
              const item = variants[line.variant]
              return (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <p className="text-gray-900">{item?.title || '—'}</p>
                    <p className="font-mono text-[11px] text-gray-500">
                      {item?.sku || 'No SKU'}
                      {item?.label ? ` · ${item.label}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{line.batch ? batches[line.batch]?.batch_number || '—' : '—'}</td>
                  <td className="px-3 py-2 text-right">{formatQty(line.quantity)}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={Number(line.quantity)}
                      step="any"
                      value={entries[line.id]?.quantity ?? ''}
                      onChange={(event) => setEntries((previous) => ({ ...previous, [line.id]: { ...previous[line.id], quantity: event.target.value } }))}
                      className="ml-auto h-7 w-24 text-right text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={entries[line.id]?.shelf || ''}
                      onChange={(event) => setEntries((previous) => ({ ...previous, [line.id]: { ...previous[line.id], shelf: event.target.value } }))}
                      className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs"
                    >
                      <option value="">No shelf</option>
                      {(data.shelves_to || []).map((shelf) => (
                        <option key={shelf.id} value={shelf.id}>
                          {shelf.code}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shortage && (
        <p className="text-xs text-amber-700">
          Some of it did not arrive. The missing units are recorded as a loss on this transfer, so say what happened.
        </p>
      )}
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={shortage ? 'What happened? (required)' : 'Note (optional)'}
        className="h-8 text-xs"
      />
      <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/80" onClick={confirm} disabled={busy}>
        {busy ? 'Accepting...' : 'Accept what arrived'}
      </Button>
    </div>
  )
}
