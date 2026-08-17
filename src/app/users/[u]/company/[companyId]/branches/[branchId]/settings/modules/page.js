"use client"

import React, { useState, useContext, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CompanyInfoContext } from '../../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'

export default function BranchModules() {
  const params = useParams()
  const router = useRouter()
  const { u, companySlug, branch } = params
  const { branches, modules } = useContext(CompanyInfoContext)

  const current = (branches || []).find(b => String(b.id) === String(branch)) || {}

  const [enabled, setEnabled] = useState(current.modules || [])
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setEnabled(current.modules || [])
    setIsDirty(false)
  }, [current])

  const toggle = (slug, checked) => {
    if (checked) setEnabled(prev => [...new Set([...(prev||[]), slug])])
    else setEnabled(prev => (prev||[]).filter(x => x !== slug))
    setIsDirty(true)
  }

  const save = async () => {
    try {
      const { error } = await supabase
        .from('branches')
        .update({ modules: enabled })
        .eq('id', current.id)

      if (error) {
        toast.error('Failed to save modules')
        return
      }

      toast.success('Branch modules updated')
      router.push(`/admin/${u}/company/${companySlug}/branches`)
    } catch (err) {
      console.error(err)
      toast.error('Unexpected error')
    }
  }

  return (
    <div className="p-4 font-WixMade">
      <h2 className="text-sm font-semibold mb-3">Modules</h2>
      <div className="flex flex-wrap gap-2 max-w-2xl">
        {modules && modules.length ? modules.filter(m => m.levels?.branchlevel).map(m => (
          <div key={m.slug} className="flex items-center gap-2 px-3 py-2 border rounded">
            <Checkbox id={`mod-${m.slug}`} checked={enabled.includes(m.slug)} onCheckedChange={(v) => toggle(m.slug, v)} />
            <label htmlFor={`mod-${m.slug}`} className="cursor-pointer">{m.title}</label>
          </div>
        )) : <div className="text-sm text-zinc-500">No branch-level modules available.</div>}
      </div>
      <div className="flex gap-2 pt-4">
        <Button className={`h-7 bg-army text-xs ${!isDirty ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={save} disabled={!isDirty}>Save</Button>
        <Button className="h-7 bg-secondary text-black text-xs" onClick={() => router.push(`/admin/${u}/company/${companySlug}/branches`)}>Cancel</Button>
      </div>
    </div>
  )
}
