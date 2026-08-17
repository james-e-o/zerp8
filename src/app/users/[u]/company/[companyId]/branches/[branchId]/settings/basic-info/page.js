"use client"

import React, { useState, useContext, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CompanyInfoContext } from '../../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'

export default function BranchBasicInfo() {
  const params = useParams()
  const router = useRouter()
  const { u, companySlug, branch } = params
  const { branches } = useContext(CompanyInfoContext)

  const current = (branches || []).find(b => String(b.id) === String(branch)) || {}

  const [name, setName] = useState(current.name || '')
  const [address, setAddress] = useState(current.address || '')
  const [contactEmail, setContactEmail] = useState(current.email || '')
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setName(current.name || '')
    setAddress(current.address || '')
    setContactEmail(current.email || '')
    setIsDirty(false)
  }, [current])

  const save = async () => {
    try {
      const { error } = await supabase
        .from('branches')
        .update({ name, address, email: contactEmail })
        .eq('id', current.id)

      if (error) {
        toast.error('Failed to save branch info')
        return
      }

      toast.success('Branch info updated')
      router.push(`/admin/${u}/company/${companySlug}/branches`)
    } catch (err) {
      console.error(err)
      toast.error('Unexpected error')
    }
  }

  return (
    <div className="p-4 font-WixMade">
      <h2 className="text-sm font-semibold mb-3">Basic Information</h2>
      <div className="grid grid-cols-1 gap-3 max-w-2xl">
        <div>
          <label className="text-xs font-medium">Branch Name</label>
          <Input className="mt-1" value={name} onChange={(e) => { setName(e.target.value); setIsDirty(true) }} />
        </div>
        <div>
          <label className="text-xs font-medium">Address</label>
          <Input className="mt-1" value={address} onChange={(e) => { setAddress(e.target.value); setIsDirty(true) }} />
        </div>
        <div>
          <label className="text-xs font-medium">Contact Email</label>
          <Input className="mt-1" value={contactEmail} onChange={(e) => { setContactEmail(e.target.value); setIsDirty(true) }} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            className={`h-7 bg-army text-xs ${!isDirty ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={save}
            disabled={!isDirty}
          >
            Save
          </Button>
          <Button className="h-7 bg-secondary text-black text-xs" onClick={() => router.push(`/admin/${u}/company/${companySlug}/branches`)}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
