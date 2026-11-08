'use client'

import { useEffect, useState } from 'react'

import supabase from '@/config/supabaseClient'

// The warehouses of one branch (archived ones left out) and which one is the
// branch's default. Used wherever a delivery or receiving location is chosen.
export function useBranchWarehouses(branchId) {
  const [warehouses, setWarehouses] = useState([])
  const [defaultId, setDefaultId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)

      const [{ data: defaultData }, { data: rows, error }] = await Promise.all([
        supabase.rpc('resolve_branch_warehouse', { p_branch: branchId }),
        supabase.from('warehouses').select('*').eq('home_branch', branchId),
      ])
      if (cancelled) return

      if (error) console.error('Could not read warehouses:', error)

      const raw = Array.isArray(defaultData) ? defaultData[0] : defaultData
      const resolvedDefault =
        raw && typeof raw === 'object' ? raw.id ?? raw.warehouse ?? Object.values(raw)[0] : raw

      const options = (rows || [])
        .filter((row) => row.is_active !== false && !row.archived_at)
        .map((row) => ({
          id: row.id,
          name: row.name || row.label || row.code || 'Warehouse',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      if (resolvedDefault && !options.some((option) => option.id === resolvedDefault)) {
        options.unshift({ id: resolvedDefault, name: 'Branch warehouse' })
      }

      setWarehouses(options)
      setDefaultId(resolvedDefault || options[0]?.id || '')
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  return { warehouses, defaultId, loading }
}