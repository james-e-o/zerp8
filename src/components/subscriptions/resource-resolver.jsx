'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ResourceResolver({ resourceName, limit, resources }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set(resources.slice(0, limit).map((item) => item.id)))
  const visible = useMemo(() => resources.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [resources, query])
  const toggle = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  return <div className="rounded-lg border border-gray-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">Resolve {resourceName} limit</h2><p className="text-xs text-gray-500">Select exactly {limit} records to remain active.</p></div><span className="text-xs font-semibold text-core">{selected.size} / {limit} selected</span></div><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${resourceName.toLowerCase()}...`} className="mb-3 h-8 text-xs" /><div className="max-h-80 divide-y overflow-y-auto">{visible.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 py-2 text-sm"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /><span>{item.name}</span></label>)}</div><Button disabled={selected.size !== limit} className="mt-5 bg-core text-white">Keep selected active</Button></div>
}
