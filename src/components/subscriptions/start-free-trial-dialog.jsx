'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check, Sparkles } from 'lucide-react'

const DISABLED_REASON = {
  trial_used: "You've already used your free trial for this company.",
  has_subscription: 'This company already has a subscription.',
}

// Name to show for a bundle that grants no modules at all (Company Core) —
// it can never be found via the module -> bundle_modules join below, so
// its presence in "Included bundles" is detected separately, from its
// limits rather than its modules.
const COMPANY_CORE_KEY = 'company_core'

export default function StartFreeTrialDialog({ label = 'Start free trial' }) {
  const router = useRouter()
  const { u, companyId } = useParams()

  const [open, setOpen] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [starting, setStarting] = useState(false)
  const [eligibility, setEligibility] = useState(null) // null while checking

  const [bundleNames, setBundleNames] = useState([])
  const [limits, setLimits] = useState([])

  // ---- Eligibility check runs once on mount, before the dialog is ever
  // opened — this is what decides whether the button itself is clickable.
  useEffect(() => {
    let cancelled = false

    async function checkEligibility() {
      const { data, error } = await supabase.rpc('get_trial_eligibility', {
        p_company_id: companyId,
      })
      if (!cancelled) setEligibility(error ? 'has_subscription' : data) // fail closed
    }

    checkEligibility()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // ---- Template fetch runs each time the dialog opens, so it always
  // reflects whatever is currently in trial_template_modules/limits.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadTemplate() {
      setLoadingTemplate(true)

      const [{ data: moduleRows }, { data: limitRows }] = await Promise.all([
        supabase.from('trial_template_modules').select('module_key, modules(name)'),
        supabase
          .from('trial_template_limits')
          .select('limit_key_id, value_numeric, value_boolean, limit_keys(key, name, unit, value_type, measurement)'),
      ])

      const moduleKeys = (moduleRows || []).map((r) => r.module_key)

      const { data: bundleMatches } = moduleKeys.length
        ? await supabase
            .from('bundle_modules')
            .select('module_key, subscription_bundles(id, key, name, status)')
            .in('module_key', moduleKeys)
          .eq('subscription_bundles.status', 'active')
        : { data: [] }

      // Group modules up to their owning bundle — a bundle with several
      // modules in the trial still shows as ONE pill, not several.
      const bundlesByKey = {}
      ;(bundleMatches || []).forEach((row) => {
        const bundle = row.subscription_bundles
        if (bundle) bundlesByKey[bundle.key] = bundle.name
      })

      // A module that matched no bundle at all still gets shown, by its
      // own name, so nothing silently disappears from the list.
      const matchedModuleKeys = new Set((bundleMatches || []).map((r) => r.module_key))
      const unbundledModuleNames = (moduleRows || [])
        .filter((r) => !matchedModuleKeys.has(r.module_key))
        .map((r) => r.modules?.name)
        .filter(Boolean)

      // Company Core grants no modules, so it can never appear via the
      // join above — detect it separately: if any of the trial's limits
      // came from Company Core's bundle_limits, show its name too.
      const { data: coreLimitKeyIds } = await supabase
        .from('bundle_limits')
        .select('limit_key_id, subscription_bundles!inner(key, name)')
        .eq('subscription_bundles.key', COMPANY_CORE_KEY)
        .eq('subscription_bundles.status', 'active')

      const trialLimitKeyIds = new Set((limitRows || []).map((r) => r.limit_key_id))
      const coreIsIncluded = (coreLimitKeyIds || []).some((r) => trialLimitKeyIds.has(r.limit_key_id))
      const coreName = coreIsIncluded ? coreLimitKeyIds[0]?.subscription_bundles?.name : null

      if (!cancelled) {
        setBundleNames([...(coreName ? [coreName] : []), ...Object.values(bundlesByKey), ...unbundledModuleNames])

        setLimits(
          (limitRows || []).map((r) => ({
            key: r.limit_keys.key,
            label: r.limit_keys.name,
            value:
              r.limit_keys.value_type === 'boolean'
                ? r.value_boolean
                  ? 'Included'
                  : '—'
                : `${Number(r.value_numeric).toLocaleString()}${r.limit_keys.unit ? ` ${r.limit_keys.unit}` : ''}${
                    r.limit_keys.measurement === 'periodic' ? '/mo' : ''
                  }`,
          }))
        )

        setLoadingTemplate(false)
      }
    }

    loadTemplate()
    return () => {
      cancelled = true
    }
  }, [open])

  const handleStartTrial = async () => {
    setStarting(true)

    const { error } = await supabase.rpc('start_free_trial', { p_company_id: companyId })

    if (error) {
      // The button is already disabled when ineligible, so this only
      // fires on a genuine race (two tabs, double submit) — a toast is
      // the right weight for that, not a persistent inline error.
      toast.error(error.message || 'Could not start your trial. Please try again.')
      setStarting(false)
      return
    }

    setStarting(false)
    setOpen(false)
    toast.success('Your free trial has started')
    router.push(`/users/${u}/company/${companyId}/subscriptions`)
  }

  const isChecking = eligibility === null
  const isDisabled = isChecking || eligibility !== 'eligible'

  return (
    <div>
      <Button
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        title={eligibility && DISABLED_REASON[eligibility]}
        className="w-full gap-2 bg-linear-to-r from-orange-400 via-army to-core text-white hover:bg-core/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="size-4" />
        {isChecking ? 'Checking...' : eligibility && eligibility !== 'eligible' ? 'Trial unavailable' : label}
      </Button>

      {eligibility && eligibility !== 'eligible' && (
        <p className="mt-1.5 text-xs text-muted-foreground">{DISABLED_REASON[eligibility]}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Start your free trial</DialogTitle>
            <DialogDescription>
              7 days, full access to the bundles and limits below — no card required.
            </DialogDescription>
          </DialogHeader>

          {loadingTemplate ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading trial details...</div>
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Included bundles</h4>
                <div className="flex flex-wrap gap-1.5">
                  {bundleNames.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bundles configured for the trial yet.</p>
                  ) : (
                    bundleNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded-full bg-core_light px-2.5 py-1 text-xs font-medium text-core"
                      >
                        <Check className="size-3" />
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Usage limits during trial</h4>
                {limits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No limits configured for the trial yet.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border bg-card">
                    {limits.map((limit) => (
                      <div key={limit.key} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-foreground">{limit.label}</span>
                        <span className="font-mono text-sm font-semibold text-foreground">{limit.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={starting}>
              Cancel
            </Button>
            <Button
              onClick={handleStartTrial}
              disabled={starting || loadingTemplate}
              className="bg-core text-white hover:bg-core/90"
            >
              {starting ? 'Starting...' : 'Start free trial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}