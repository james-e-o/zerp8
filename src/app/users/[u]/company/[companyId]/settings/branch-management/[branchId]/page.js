"use client"

import { useContext, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyInfoContext } from '../../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'

function DetailItem({ label, value }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

function getCurrencyRate(configuration) {
  return Number(typeof configuration === 'object' ? configuration?.rate : configuration)
}

function getRatesAgainstCompanyDefault(branch, defaultCurrency, currencyCodes) {
  const branchCurrencies = branch?.currencies || {}
  let defaultRate = getCurrencyRate(branchCurrencies[defaultCurrency])
  if (!(defaultRate > 0) && branch?.base_currency === defaultCurrency) defaultRate = 1

  return Object.fromEntries(currencyCodes.map((code) => {
    if (code === defaultCurrency) return [code, '1']
    const branchRate = getCurrencyRate(branchCurrencies[code])
    return [code, defaultRate > 0 && branchRate > 0 ? String(branchRate / defaultRate) : '']
  }))
}

function toBranchCurrencyConfiguration(currencyCodes, defaultCurrency, baseCurrency, companyRates) {
  const baseRate = Number(companyRates[baseCurrency])
  return Object.fromEntries(currencyCodes.flatMap((code) => {
    if (code === baseCurrency) return [[code, { base: true, rate: 1 }]]

    const companyRate = code === defaultCurrency ? 1 : Number(companyRates[code])
    if (!(companyRate > 0) || !(baseRate > 0)) return []

    return [[code, {
      base: false,
      rate: Number((companyRate / baseRate).toFixed(10)),
    }]]
  }))
}

export default function BranchManagementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { branches, accessLevelScope, info, currencies } = useContext(CompanyInfoContext)
  const branch = branches?.find((item) => String(item.id) === String(params.branchId))
  const [profileEditing, setProfileEditing] = useState(false)
  const [currencyEditing, setCurrencyEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [currencySaving, setCurrencySaving] = useState(false)
  const [savedProfile, setSavedProfile] = useState(null)
  const [savedCurrencies, setSavedCurrencies] = useState(null)
  const [profileForm, setProfileForm] = useState(null)
  const [currencyForm, setCurrencyForm] = useState(null)

  const branchView = branch
    ? {
        ...branch,
        ...(savedProfile?.id === branch.id ? savedProfile : {}),
        ...(savedCurrencies?.id === branch.id ? savedCurrencies : {}),
      }
    : null

  const companyCurrencyCodes = Array.isArray(info?.currencies)
    ? info.currencies
    : (currencies || []).map((currency) => currency.code)
  const companyDefaultCurrency = info?.default_currency || companyCurrencyCodes[0] || branchView?.base_currency || ''
  const enabledCurrencyCodes = [...new Set([
    ...companyCurrencyCodes,
    ...(companyDefaultCurrency ? [companyDefaultCurrency] : []),
  ])]
  const enabledCompanyCurrencies = enabledCurrencyCodes.map((code) =>
    (currencies || []).find((currency) => currency.code === code) || { code, name: code }
  )
  const displayRates = getRatesAgainstCompanyDefault(branchView, companyDefaultCurrency, enabledCurrencyCodes)
  const requiresBranchBaseRate = currencyForm?.base_currency && currencyForm.base_currency !== companyDefaultCurrency
  const hasValidBranchBaseRate = Number(currencyForm?.rates?.[currencyForm?.base_currency]) > 0

  const startProfileEditing = () => {
    setProfileForm({
  
        name: branchView.name || '',
      address: branchView.address || '',
      city: branchView.city || '',
      country: branchView.country || '',
      email: branchView.email || '',
      phone: branchView.phone || '',
    })
    setProfileEditing(true)
  }

  const updateProfileForm = (event) => {
    const { name, value } = event.target
    setProfileForm((current) => ({ ...current, [name]: value }))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!profileForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }

    setProfileSaving(true)
    try {
      const updates = {
        name: profileForm.name.trim(),
        address: profileForm.address.trim() || null,
        city: profileForm.city.trim() || null,
        country: profileForm.country.trim() || null,
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
      }
      const { error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', branchView.id)
        .eq('company', params.companyId)

      if (error) {
        toast.error('Failed to update branch details')
        return
      }

      setSavedProfile({ id: branchView.id, ...updates })
      setProfileEditing(false)
      toast.success('Branch details updated')
      router.refresh()
    } catch (error) {
      console.error('Failed to update branch details:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setProfileSaving(false)
    }
  }

  const startCurrencyEditing = () => {
    const baseCurrency = enabledCurrencyCodes.includes(branchView.base_currency)
      ? branchView.base_currency
      : companyDefaultCurrency
    setCurrencyForm({
      base_currency: baseCurrency,
      rates: getRatesAgainstCompanyDefault(branchView, companyDefaultCurrency, enabledCurrencyCodes),
    })
    setCurrencyEditing(true)
  }

  const updateCurrencyRate = (code, value) => {
    setCurrencyForm((current) => ({
      ...current,
      rates: { ...current.rates, [code]: value },
    }))
  }

  const saveCurrencyConfiguration = async (event) => {
    event.preventDefault()
    const selectedBaseRate = Number(currencyForm.rates[currencyForm.base_currency])
    if (
      currencyForm.base_currency !== companyDefaultCurrency &&
      !(selectedBaseRate > 0)
    ) {
      toast.error(`Enter a valid exchange rate for ${currencyForm.base_currency}`)
      return
    }

    const companyRates = {
      ...currencyForm.rates,
      [companyDefaultCurrency]: '1',
    }

    setCurrencySaving(true)
    try {
      const branchCurrencyConfig = toBranchCurrencyConfiguration(
        enabledCurrencyCodes,
        companyDefaultCurrency,
        currencyForm.base_currency,
        companyRates,
      )
      const { error } = await supabase
        .from('branches')
        .update({
          base_currency: currencyForm.base_currency,
          currencies: branchCurrencyConfig,
        })
        .eq('id', branchView.id)
        .eq('company', params.companyId)

      if (error) {
        toast.error('Failed to update currency configuration')
        return
      }

      setSavedCurrencies({
        id: branchView.id,
        base_currency: currencyForm.base_currency,
        currencies: branchCurrencyConfig,
      })
      setCurrencyEditing(false)
      toast.success('Currency configuration updated')
      router.refresh()
    } catch (error) {
      console.error('Failed to update currency configuration:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setCurrencySaving(false)
    }
  }

  const listPath = `/users/${params.u}/company/${params.companyId}/settings/branch-management`

  if (!branchView) {
    return (
      <main className="w-full font-WixMade">
        <header>
          <h1 className="text-lg font-semibold text-foreground">Branch details</h1>
          <p className="mt-1 text-xs text-muted-foreground">This branch could not be found.</p>
        </header>
        <Link href={listPath} className="mt-4 inline-flex h-8 items-center gap-2 rounded-md bg-core_light px-2 text-xs font-medium text-core hover:bg-core_light/80">
          <ArrowLeft className="size-4" />
          Back to branch management
        </Link>
      </main>
    )
  }

  const currencyEntries = Object.entries(branchView.currencies || {})

  return (
    <main className="w-full font-WixMade">
      <header>
        <h1 className="text-lg font-semibold text-foreground">{branchView.name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Branch profile and configuration</p>
      </header>

      <div className="mt-4">
        <Link
          href={listPath}
          className="inline-flex h-8 items-center gap-2 rounded-md bg-core_light px-2 text-xs font-medium text-core transition-colors hover:bg-core_light/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          Branch management
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-core" />
              <h2 className="text-sm font-semibold text-foreground">Branch profile</h2>
            </div>
            {accessLevelScope === 'company' && (
              <Button
                type="button"
                variant={profileEditing ? 'ghost' : 'outline'}
                size="icon-sm"
                aria-label={profileEditing ? 'Cancel branch profile editing' : 'Edit branch profile'}
                title={profileEditing ? 'Cancel editing' : 'Edit branch profile'}
                onClick={() => profileEditing ? setProfileEditing(false) : startProfileEditing()}
              >
                {profileEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
              </Button>
            )}
          </div>
          {profileEditing ? (
            <form onSubmit={saveProfile} className="space-y-3">
              <label className="block space-y-1.5 text-xs font-medium text-foreground">
                Branch ID
                <Input value={branchView.id} readOnly />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-foreground">
                Office type
                <Input value={branchView.isheadoffice ? 'Head office' : 'Branch'} readOnly />
              </label>
              {[
                { name: 'name', label: 'Branch name', required: true },
                { name: 'address', label: 'Street address' },
                { name: 'city', label: 'City' },
                { name: 'country', label: 'Country' },
                { name: 'email', label: 'Contact email', type: 'email' },
                { name: 'phone', label: 'Phone' },
              ].map((field) => (
                <label key={field.name} className="block space-y-1.5 text-xs font-medium text-foreground">
                  {field.label}
                  <Input
                    name={field.name}
                    type={field.type || 'text'}
                    required={field.required}
                    value={profileForm[field.name]}
                    onChange={updateProfileForm}
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setProfileEditing(false)} disabled={profileSaving}>Cancel</Button>
                <Button type="submit" className="bg-army hover:bg-army/85" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="divide-y divide-border">
              <DetailItem label="Branch ID" value={branchView.id} />
              <DetailItem label="Office type" value={branchView.isheadoffice ? 'Head office' : 'Branch'} />
              <DetailItem label="Branch name" value={branchView.name} />
              <DetailItem label="Street address" value={branchView.address} />
              <DetailItem label="City" value={branchView.city} />
              <DetailItem label="Country" value={branchView.country} />
              <DetailItem label="Contact email" value={branchView.email} />
              <DetailItem label="Phone" value={branchView.phone} />
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-core" />
              <h2 className="text-sm font-semibold text-foreground">Currency configuration</h2>
            </div>
            {accessLevelScope === 'company' && (
              <Button
                type="button"
                variant={currencyEditing ? 'ghost' : 'outline'}
                size="icon-sm"
                aria-label={currencyEditing ? 'Cancel currency editing' : 'Edit currency configuration'}
                title={currencyEditing ? 'Cancel editing' : 'Edit currency configuration'}
                onClick={() => currencyEditing ? setCurrencyEditing(false) : startCurrencyEditing()}
              >
                {currencyEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
              </Button>
            )}
          </div>
          {currencyEditing ? (
            <form onSubmit={saveCurrencyConfiguration} className="space-y-3">
              <label className="block space-y-1.5 text-xs font-medium text-foreground">
                Company default currency
                <Input className="bg-background" value={companyDefaultCurrency} readOnly />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-foreground">
                Enabled company currencies
                <Input className="bg-background" value={enabledCurrencyCodes.join(', ')} readOnly />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-foreground">
                Branch base currency
                <Select
                  value={currencyForm.base_currency}
                  onValueChange={(value) => setCurrencyForm((current) => ({ ...current, base_currency: value }))}
                  disabled={!enabledCompanyCurrencies.length}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledCompanyCurrencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-foreground">Exchange rates</p>
                <label className="block space-y-1.5 text-xs font-medium text-foreground">
                  1 {companyDefaultCurrency} equals
                  <Input className="bg-background" value="1" readOnly />
                </label>
                {currencyForm.base_currency !== companyDefaultCurrency && (
                  <div className="space-y-1.5">
                    <label htmlFor="branch-base-rate" className="text-xs font-medium text-foreground">
                      1 {companyDefaultCurrency} =
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="branch-base-rate"
                        className="bg-background"
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={currencyForm.rates[currencyForm.base_currency] || ''}
                        onChange={(event) => updateCurrencyRate(currencyForm.base_currency, event.target.value)}
                      />
                      <span className="shrink-0 text-sm font-medium text-foreground">{currencyForm.base_currency}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Required because the branch base differs from the company default.
                    </p>
                  </div>
                )}
                {currencyForm.base_currency === companyDefaultCurrency && (
                  <p className="text-xs text-muted-foreground">
                    The company default is the branch base, so its exchange rate is fixed at 1.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setCurrencyEditing(false)} disabled={currencySaving}>Cancel</Button>
                <Button
                  type="submit"
                  className="bg-core text-white hover:bg-core/85"
                  disabled={currencySaving || !companyDefaultCurrency || (requiresBranchBaseRate && !hasValidBranchBaseRate)}
                >
                  {currencySaving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <dl className="divide-y divide-border">
                <DetailItem label="Company default currency" value={companyDefaultCurrency} />
                <DetailItem label="Enabled company currencies" value={enabledCurrencyCodes.join(', ')} />
                <DetailItem label="Branch base currency" value={branchView.base_currency || companyDefaultCurrency} />
              </dl>
              <div className="mt-3 border-t border-border pt-3">
                <h3 className="text-xs font-medium text-muted-foreground">Exchange rates</h3>
                <ul className="mt-2 divide-y divide-border">
                  {enabledCurrencyCodes.map((code) => (
                    <li key={code} className="flex justify-between gap-4 py-2 text-sm">
                      <span className="text-foreground">1 {companyDefaultCurrency} =</span>
                      <span className="font-mono text-muted-foreground">
                        {code === companyDefaultCurrency ? '1' : Number(displayRates[code]) > 0 ? displayRates[code] : 'Not set'} {code}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}