"use client"

import { useContext, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CircleDollarSign, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BranchContext } from "../../branchContext"
import { CompanyInfoContext } from "../../../../companyInfoProvider"
import supabase from "@/config/supabaseClient"
import { toast } from "sonner"

function CurrencyDetail({ label, value }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  )
}

function getCurrencyRate(configuration) {
  return Number(typeof configuration === "object" ? configuration?.rate : configuration)
}

function getRatesAgainstCompanyDefault(branch, defaultCurrency, currencyCodes) {
  const branchCurrencies = branch?.currencies || {}
  let defaultRate = getCurrencyRate(branchCurrencies[defaultCurrency])
  if (!(defaultRate > 0) && branch?.base_currency === defaultCurrency) defaultRate = 1

  return Object.fromEntries(
    currencyCodes.map((code) => {
      if (code === defaultCurrency) return [code, "1"]
      const branchRate = getCurrencyRate(branchCurrencies[code])
      return [
        code,
        defaultRate > 0 && branchRate > 0 ? String(branchRate / defaultRate) : "",
      ]
    }),
  )
}

function toBranchCurrencyConfiguration(currencyCodes, defaultCurrency, baseCurrency, companyRates) {
  const baseRate = Number(companyRates[baseCurrency])
  return Object.fromEntries(
    currencyCodes.flatMap((code) => {
      if (code === baseCurrency) return [[code, { base: true, rate: 1 }]]

      const companyRate = code === defaultCurrency ? 1 : Number(companyRates[code])
      if (!(companyRate > 0) || !(baseRate > 0)) return []

      return [[code, { base: false, rate: Number((companyRate / baseRate).toFixed(10)) }]]
    }),
  )
}

export default function BranchFiscalCurrency() {
  const { companyId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext)
  const { accessLevelScope, info, currencies = [] } = useContext(CompanyInfoContext)
  const [savedCurrencies, setSavedCurrencies] = useState(null)
  const [currencyForm, setCurrencyForm] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const branch = currentBranch
    ? {
        ...currentBranch,
        ...(savedCurrencies?.id === currentBranch.id ? savedCurrencies : {}),
      }
    : null
  const companyCurrencyCodes = Array.isArray(info?.currencies)
    ? info.currencies
    : currencies.map((currency) => currency.code)
  const companyDefaultCurrency =
    info?.default_currency || companyCurrencyCodes[0] || branch?.base_currency || ""
  const enabledCurrencyCodes = [
    ...new Set([
      ...companyCurrencyCodes,
      ...(companyDefaultCurrency ? [companyDefaultCurrency] : []),
    ]),
  ]
  const availableCurrencies = enabledCurrencyCodes.map(
    (code) => currencies.find((currency) => currency.code === code) || { code, name: code },
  )
  const displayRates = getRatesAgainstCompanyDefault(
    branch,
    companyDefaultCurrency,
    enabledCurrencyCodes,
  )
  const requiresBranchBaseRate =
    currencyForm?.base_currency && currencyForm.base_currency !== companyDefaultCurrency
  const hasValidBranchBaseRate =
    Number(currencyForm?.rates?.[currencyForm?.base_currency]) > 0

  const startEditing = () => {
    const baseCurrency = enabledCurrencyCodes.includes(branch.base_currency)
      ? branch.base_currency
      : companyDefaultCurrency
    setCurrencyForm({
      base_currency: baseCurrency,
      rates: getRatesAgainstCompanyDefault(branch, companyDefaultCurrency, enabledCurrencyCodes),
    })
    setIsEditing(true)
  }

  const updateCurrencyRate = (code, value) => {
    setCurrencyForm((current) => ({
      ...current,
      rates: { ...current.rates, [code]: value },
    }))
  }

  const saveConfiguration = async (event) => {
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
      [companyDefaultCurrency]: "1",
    }

    setIsSaving(true)
    try {
      const branchCurrencyConfig = toBranchCurrencyConfiguration(
        enabledCurrencyCodes,
        companyDefaultCurrency,
        currencyForm.base_currency,
        companyRates,
      )
      const { error } = await supabase
        .from("branches")
        .update({
          base_currency: currencyForm.base_currency,
          currencies: branchCurrencyConfig,
        })
        .eq("id", branch.id)
        .eq("company", companyId)

      if (error) {
        console.error("Failed to update currency configuration:", error)
        toast.error("Failed to update currency configuration")
        return
      }

      setSavedCurrencies({
        id: branch.id,
        base_currency: currencyForm.base_currency,
        currencies: branchCurrencyConfig,
      })
      setIsEditing(false)
      toast.success("Currency configuration updated")
      router.refresh()
    } catch (error) {
      console.error("Failed to update currency configuration:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  if (!branch) {
    return <p className="p-2 text-xs text-muted-foreground">Currency configuration is unavailable.</p>
  }

  return (
    <main className="space-y-4 p-2">
      <header>
        <h1 className="text-base font-semibold tracking-tight text-core">Currency configuration</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure the branch base currency and its exchange rate against the company default.
        </p>
      </header>

      <section className="max-w-3xl rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-4 text-core" />
            <h2 className="text-sm font-semibold text-foreground">Fiscal & currency</h2>
          </div>
          {accessLevelScope === "company" && (
            <Button
              type="button"
              variant={isEditing ? "ghost" : "outline"}
              size="icon-sm"
              aria-label={isEditing ? "Cancel currency editing" : "Edit currency configuration"}
              title={isEditing ? "Cancel editing" : "Edit currency configuration"}
              onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
            >
              {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={saveConfiguration} className="space-y-3">
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Company default currency
              <Input value={companyDefaultCurrency} readOnly />
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Enabled company currencies
              <Input value={enabledCurrencyCodes.join(", ")} readOnly />
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Branch base currency
              <Select
                value={currencyForm.base_currency}
                onValueChange={(value) =>
                  setCurrencyForm((current) => ({ ...current, base_currency: value }))
                }
                disabled={!availableCurrencies.length}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
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
                <Input value="1" readOnly />
              </label>
              {currencyForm.base_currency !== companyDefaultCurrency ? (
                <div className="space-y-1.5">
                  <label htmlFor="branch-base-rate" className="text-xs font-medium text-foreground">
                    1 {companyDefaultCurrency} =
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="branch-base-rate"
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={currencyForm.rates[currencyForm.base_currency] || ""}
                      onChange={(event) =>
                        updateCurrencyRate(currencyForm.base_currency, event.target.value)
                      }
                    />
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      {currencyForm.base_currency}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required because the branch base differs from the company default.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The company default is the branch base, so its exchange rate is fixed at 1.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-core text-white hover:bg-core/85"
                disabled={
                  isSaving ||
                  !companyDefaultCurrency ||
                  !availableCurrencies.length ||
                  (requiresBranchBaseRate && !hasValidBranchBaseRate)
                }
              >
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <dl className="divide-y divide-border">
              <CurrencyDetail label="Company default currency" value={companyDefaultCurrency} />
              <CurrencyDetail
                label="Enabled company currencies"
                value={enabledCurrencyCodes.join(", ")}
              />
              <CurrencyDetail
                label="Branch base currency"
                value={branch.base_currency || companyDefaultCurrency}
              />
            </dl>
            <div className="mt-3 border-t border-border pt-3">
              <h3 className="text-xs font-medium text-muted-foreground">Exchange rates</h3>
              {enabledCurrencyCodes.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {enabledCurrencyCodes.map((code) => (
                    <li key={code} className="flex justify-between gap-4 py-2 text-sm">
                      <span className="text-foreground">1 {companyDefaultCurrency} =</span>
                      <span className="font-mono text-muted-foreground">
                        {code === companyDefaultCurrency
                          ? "1"
                          : Number(displayRates[code]) > 0
                            ? displayRates[code]
                            : "Not set"}{" "}
                        {code}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No company currencies are configured.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
