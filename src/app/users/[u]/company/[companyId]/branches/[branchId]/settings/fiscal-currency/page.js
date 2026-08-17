"use client"

import React, { useState, useContext, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CompanyInfoContext } from '../../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'

export default function BranchFiscalCurrency() {
  const params = useParams()
  const router = useRouter()
  const { u, companySlug, branch } = params
  const { branches, currencies: companyCurrencies } = useContext(CompanyInfoContext)

  const current = (branches || []).find(b => String(b.id) === String(branch)) || {}

  const [baseCurrency, setBaseCurrency] = useState(current.base_currency || (companyCurrencies && companyCurrencies[0] ? companyCurrencies[0].code : ''))
  const [selectedCurrencies, setSelectedCurrencies] = useState([])
  const [currencyConfig, setCurrencyConfig] = useState({})
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    const selected = [...new Set([...(current.currencies ? Object.keys(current.currencies) : []), current.base_currency])].filter(Boolean)
    setSelectedCurrencies(selected)

    const cfg = {}
    selected.forEach(code => {
      const existing = current.currencies && current.currencies[code]
      cfg[code] = existing ? existing : { base: code === current.base_currency, rate: 1 }
    })
    setCurrencyConfig(cfg)
    setBaseCurrency(current.base_currency || (companyCurrencies && companyCurrencies[0] ? companyCurrencies[0].code : ''))
    setIsDirty(false)
  }, [current, companyCurrencies])

  useEffect(() => {
    // ensure base present
    if (baseCurrency && !selectedCurrencies.includes(baseCurrency)) {
      setSelectedCurrencies(prev => [baseCurrency, ...prev])
    }
  }, [baseCurrency])

  const toggleCurrency = (code, checked) => {
    if (checked) setSelectedCurrencies(prev => [...new Set([...(prev || []), code])])
    else setSelectedCurrencies(prev => (prev || []).filter(c => c !== code))
    setIsDirty(true)
  }

  const save = async () => {
    try {
      const cfg = { ...(currencyConfig || {}) }
      // ensure base has rate 1
      if (baseCurrency) cfg[baseCurrency] = { ...(cfg[baseCurrency] || {}), base: true, rate: 1 }

      const { error } = await supabase
        .from('branches')
        .update({ base_currency: baseCurrency, currencies: cfg })
        .eq('id', current.id)

      if (error) {
        toast.error('Failed to save currencies')
        return
      }

      toast.success('Branch currencies updated')
      router.push(`/admin/${u}/company/${companySlug}/branches`)
    } catch (err) {
      console.error(err)
      toast.error('Unexpected error')
    }
  }

  return (
    <div className="p-4 font-WixMade">
      <h2 className="text-sm font-semibold mb-3">Fiscal & Currency</h2>
      <div className="grid grid-cols-1 gap-3 max-w-2xl">
        <div>
          <label className="text-xs font-medium">Base Currency</label>
          <Select value={baseCurrency} onValueChange={(v) => { setBaseCurrency(v); setIsDirty(true) }}>
            <SelectTrigger className="mt-1 h-7 text-[10px] flex items-center gap-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(companyCurrencies || []).map(c => (
                <SelectItem key={c.code} value={c.code} className="text-[10px]">
                  <div className="flex items-center gap-2">
                    <img src={c.flag} alt={c.name} className="w-4 h-4" />
                    <span>{c.code} - {c.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium">Enable Currencies</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(companyCurrencies || []).map(c => (
              <div key={c.code} className="flex items-center gap-2 px-2 py-1 border rounded">
                <Checkbox id={`curr-${c.code}`} checked={selectedCurrencies.includes(c.code)} onCheckedChange={(v) => toggleCurrency(c.code, v)} disabled={c.code === baseCurrency} />
                <label htmlFor={`curr-${c.code}`} className="text-[13px] flex items-center gap-2 cursor-pointer"><img src={c.flag} className="w-4 h-4" />{c.code}</label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Exchange Rates (against Base)</label>
          <div className="space-y-2 mt-2">
            {selectedCurrencies.filter(code => code !== baseCurrency).map(code => {
              const curr = (companyCurrencies || []).find(x => x.code === code)
              const baseObj = (companyCurrencies || []).find(x => x.code === baseCurrency)
              return (
                <div key={code} className="flex items-center gap-2">
                  <img src={baseObj?.flag} alt={baseObj?.name} className="w-4 h-4" />
                  <div className="text-[10px]">1 {baseCurrency} =</div>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28 h-7 p-1 text-[10px]"
                    value={currencyConfig[code]?.rate || ''}
                    onChange={(e) => { setCurrencyConfig(prev => ({ ...prev, [code]: { ...(prev[code]||{}), rate: parseFloat(e.target.value) || 0 } })); setIsDirty(true) }}
                  />
                  <img src={curr?.flag} alt={curr?.name} className="w-4 h-4" />
                  <div className="text-[10px]">{curr?.code}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className={`h-7 bg-army text-xs ${!isDirty ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={save} disabled={!isDirty}>Save</Button>
          <Button className="h-7 bg-secondary text-black text-xs" onClick={() => router.push(`/admin/${u}/company/${companySlug}/branches`)}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
