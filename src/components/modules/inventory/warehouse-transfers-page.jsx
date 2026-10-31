'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import supabase from '@/config/supabaseClient'
import { formatQty } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone } from '@/components/modules/inventory/receipt-shared'
import { formatDateTime } from '@/components/modules/inventory/adjustment-shared'
import { useTransferPaths } from '@/components/modules/inventory/transfer-shared'
import TransferReceivePanel from '@/components/modules/inventory/transfer-receive-panel'

// Inventory > Warehouses > one warehouse > Transfers.
// What is on its way out of this warehouse (stock has left, nobody has
// accepted it yet) and what is on its way in. Accepting happens here: open an
// incoming transfer, say what arrived and where it goes. A warehouse can only
// accept; cancelling is management's, from the transfer itself.

export default function WarehouseTransfersPage() {
  const { warehouseId } = useParams()
  const { transfers } = useTransferPaths()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openId, setOpenId] = useState('')
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    if (!warehouseId) return
    setLoadError('')
    const { data, error } = await supabase.rpc('list_warehouse_transfers', { p_warehouse: warehouseId })
    if (error) {
      setLoadError(error.message)
      toast.error(error.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [warehouseId])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(row) {
    if (openId === row.id) {
      setOpenId('')
      setDetail(null)
      return
    }
    setOpenId(row.id)
    setDetail(null)
    const { data, error } = await supabase.rpc('get_inventory_transfer', { p_transfer: row.id })
    if (error || !data) {
      toast.error(error?.message || 'Could not open that transfer.')
      setOpenId('')
      return
    }
    setDetail(data)
  }

  async function afterAccept() {
    setOpenId('')
    setDetail(null)
    await load()
  }

  const incoming = rows.filter((row) => row.direction === 'incoming')
  const outgoing = rows.filter((row) => row.direction === 'outgoing')

  if (loading) return <p className="p-6 text-xs text-gray-500">Loading transfers...</p>
  if (loadError) return <div className="p-6"><ErrorNote>{loadError}</ErrorNote></div>

  return (
    <div className="max-w-5xl space-y-6 p-4">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-800">Incoming, waiting to be accepted ({incoming.length})</h3>
        {incoming.length === 0 ? (
          <EmptyState>Nothing is on its way to this warehouse.</EmptyState>
        ) : (
          incoming.map((row) => (
            <div key={row.id} className="rounded-lg border border-blue-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-900">
                    <Link href={`${transfers}/${row.id}`} className="font-mono hover:underline">
                      {row.transfer_number}
                    </Link>{' '}
                    <Tone tone="blue">Incoming</Tone>
                  </p>
                  <p className="text-[11px] text-gray-600">
                    From {row.from_warehouse_name} ({row.from_branch_name}) · {row.line_count} line{Number(row.line_count) === 1 ? '' : 's'} · {formatQty(row.total_quantity)} units · sent {formatDateTime(row.sent_at)}
                  </p>
                </div>
                {row.can_receive && (
                  <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => toggle(row)}>
                    {openId === row.id ? 'Close' : 'Check and accept'}
                  </Button>
                )}
              </div>
              {openId === row.id && (
                <div className="mt-3">
                  {detail ? <TransferReceivePanel data={detail} onDone={afterAccept} /> : <p className="text-xs text-gray-500">Loading...</p>}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-800">Outgoing, on the way ({outgoing.length})</h3>
        {outgoing.length === 0 ? (
          <EmptyState>Nothing has left this warehouse that is still on the way.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-left">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outgoing.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      <Link href={`${transfers}/${row.id}`} className="hover:underline">
                        {row.transfer_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {row.to_warehouse_name} <span className="text-[10px] text-gray-500">({row.to_branch_name})</span>
                    </td>
                    <td className="px-3 py-2 text-right">{Number(row.line_count)}</td>
                    <td className="px-3 py-2 text-right">{formatQty(row.total_quantity)}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDateTime(row.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
