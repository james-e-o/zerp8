'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import supabase from '@/config/supabaseClient'
import { useAdjustmentPaths } from '@/components/modules/inventory/adjustment-shared'

// Inventory > Adjustments > New.
// Choose what this is, which warehouse, and (for a count) whether to start
// with every product that has stock there. The lines are entered on the next
// page.
//
// No permission check on this screen: whether to show the page at all is
// decided by the front-end access rules. If someone without permission presses
// Start, the database refuses and its message appears as a toast.

const KINDS = [
  {
    value: 'count',
    label: 'Stock count',
    text: 'Someone counts what is on the shelf. The system works out the difference from what the books said at the time of the count, and posts only that difference.',
  },
  {
    value: 'adjustment',
    label: 'Adjustment',
    text: 'A direct change with a reason: damaged, expired, lost, theft, found or a correction.',
  },
]

export default function NewAdjustmentPage() {
  const router = useRouter()
  const { branchId, adjustments } = useAdjustmentPaths()

  const [warehouses, setWarehouses] = useState([])
  const [shelves, setShelves] = useState([])
  const [kind, setKind] = useState('count')
  const [warehouse, setWarehouse] = useState('')
  const [shelf, setShelf] = useState('')
  const [populate, setPopulate] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!branchId) return
    supabase
      .from('warehouses')
      .select('id, name, code, is_default, archived_at')
      .eq('home_branch', branchId)
      .is('archived_at', null)
      .order('is_default', { ascending: false })
      .order('name')
      .then(({ data, error: loadError }) => {
        if (loadError) {
          toast.error(loadError.message)
          return
        }
        setWarehouses(data || [])
        if (data?.length) setWarehouse(data[0].id)
      })
  }, [branchId])

  useEffect(() => {
    setShelf('')
    setShelves([])
    if (!warehouse) return
    supabase
      .from('warehouse_shelves')
      .select('id, code, name')
      .eq('warehouse', warehouse)
      .is('archived_at', null)
      .order('code')
      .then(({ data }) => setShelves(data || []))
  }, [warehouse])

  async function handleStart(event) {
    event.preventDefault()
    if (!warehouse) {
      toast.error('Pick a warehouse.')
      return
    }
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('create_inventory_adjustment', {
      p_branch: branchId,
      p_warehouse: warehouse,
      p_kind: kind,
      p_note: note || null,
      p_populate: kind === 'count' && populate,
      p_shelf: kind === 'count' && populate && shelf ? shelf : null,
    })
    setBusy(false)
    if (rpcError) {
      toast.error(rpcError.message)
      return
    }
    if (!data?.success) {
      toast.error(data?.error || 'Could not start it.')
      return
    }
    router.push(`${adjustments}/${data.adjustment_id}`)
  }

  return (
    <form onSubmit={handleStart} className="max-w-2xl space-y-5 p-1">

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-800">What is this?</h2>
        {KINDS.map((entry) => (
          <label
            key={entry.value}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 ${kind === entry.value ? 'border-core bg-core/5' : 'border-gray-200'}`}
          >
            <input type="radio" name="kind" className="mt-0.5" checked={kind === entry.value} onChange={() => setKind(entry.value)} />
            <span>
              <span className="block text-xs font-medium text-gray-900">{entry.label}</span>
              <span className="mt-0.5 block text-[11px] text-gray-600">{entry.text}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-700">
          Warehouse
          <select
            value={warehouse}
            onChange={(event) => setWarehouse(event.target.value)}
            className="mt-1 block h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
          >
            {warehouses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.code ? ` (${entry.code})` : ''}
              </option>
            ))}
          </select>
        </label>

        {kind === 'count' && (
          <>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5" checked={populate} onChange={(event) => setPopulate(event.target.checked)} />
              <span>
                <span className="block text-xs font-medium text-gray-900">Start with every product that has stock here</span>
                <span className="block text-[11px] text-gray-500">
                  Each one is listed for you to count. Anything you do not count is left out, not treated as zero.
                </span>
              </span>
            </label>
            {populate && shelves.length > 0 && (
              <label className="block text-xs font-medium text-gray-700">
                Only this shelf (optional)
                <select
                  value={shelf}
                  onChange={(event) => setShelf(event.target.value)}
                  className="mt-1 block h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                >
                  <option value="">Whole warehouse</option>
                  {shelves.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.code}
                      {entry.name ? ` - ${entry.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <label className="block text-xs font-medium text-gray-700">
          Note (optional)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          />
        </label>
      </section>

      <div className="flex gap-2">
        <Link href={adjustments} className="inline-flex h-7 items-center rounded-md border border-gray-300 px-3 text-xs text-gray-700">
          Cancel
        </Link>
        <Button type="submit" disabled={busy} className="h-7 bg-core text-xs text-white hover:bg-core/80">
          {busy ? 'Starting...' : 'Start'}
        </Button>
      </div>
    </form>
  )
}