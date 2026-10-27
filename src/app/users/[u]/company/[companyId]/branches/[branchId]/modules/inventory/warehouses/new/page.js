'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useInventoryPaths } from '@/components/modules/inventory/inventory-shared'
import { ErrorNote, useInventoryCan } from '@/components/modules/inventory/receipt-shared'
import { runWarehouseRpc } from '@/components/modules/inventory/warehouse-shared'

// Inventory > Warehouses > New warehouse.
// The code is optional: left blank, the next free WH-### is used.

export default function NewWarehousePage() {
  const router = useRouter()
  const { branchId, warehouses: warehousesPath } = useInventoryPaths()
  const canEdit = useInventoryCan('edit')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the warehouse a name.')
      return
    }
    setSaving(true)
    setError('')
    const result = await runWarehouseRpc('create_warehouse', {
      p_branch: branchId,
      p_name: name,
      p_code: code.trim() || null,
      p_make_default: makeDefault,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push(`${warehousesPath}/${result.data.warehouse_id}`)
  }

  return (
    <form onSubmit={handleCreate} className="max-w-xl space-y-4 p-4">
      <h2 className="text-sm font-semibold text-gray-900">New warehouse</h2>
      {!canEdit && <ErrorNote>You do not have permission to add warehouses for this branch.</ErrorNote>}

          <section className="space-y-4 rounded-lg border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-700">
              Name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Lagos Main Warehouse"
                className="mt-1 h-auto text-sm"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Code (optional)
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Leave blank for the next WH number"
                className="mt-1 h-auto font-mono text-sm uppercase"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Must be unique in the company. It is how people recognise this warehouse in lists.
              </span>
            </label>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-800">Make this the default warehouse</p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  New receipts go here unless someone picks another. A branch&apos;s first warehouse is always the
                  default.
                </p>
              </div>
              <Switch checked={makeDefault} onCheckedChange={setMakeDefault} />
            </div>
          </section>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving || !canEdit} className="h-7 bg-core text-xs text-white hover:bg-core/80">
              {saving ? 'Saving...' : 'Create warehouse'}
            </Button>
            <Link href={warehousesPath} className="text-xs text-gray-600 hover:underline">
              Cancel
            </Link>
          </div>
    </form>
  )
}
