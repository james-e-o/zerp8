'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check, Sparkles } from 'lucide-react'

const TRIAL_TEMPLATE = {
  duration_days: 7,
  modules: ['Inventory', 'Products', 'Sales', 'Purchases', 'Staff & Roles'],
  limits: [
    { label: 'Active products', value: '100' },
    { label: 'Branches', value: '1' },
    { label: 'Staff members', value: '5' },
    { label: 'Sales orders / month', value: '200' },
    { label: 'Warehouses', value: '1' },
  ],
}

export default function StartFreeTrialDialog({ label = 'Start free trial' }) {
  const router = useRouter()
  const { u, companyId } = useParams()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleStartTrial = async () => {
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setLoading(false)
    setOpen(false)
    router.push(`/users/${u}/company/${companyId}/subscriptions`)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full gap-2 bg-linear-to-r from-orange-400 via-army to-core text-white hover:bg-core/90">
        <Sparkles className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Start your free trial</DialogTitle>
            <DialogDescription>{TRIAL_TEMPLATE.duration_days} days, full access to the modules and limits below - no card required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Included modules</h4>
              <div className="flex flex-wrap gap-1.5">
                {TRIAL_TEMPLATE.modules.map((module) => (
                  <span key={module} className="inline-flex items-center gap-1 rounded-full bg-core_light px-2.5 py-1 text-xs font-medium text-core"><Check className="size-3" />{module}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Usage limits during trial</h4>
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {TRIAL_TEMPLATE.limits.map((limit) => <div key={limit.label} className="flex items-center justify-between px-4 py-2.5"><span className="text-sm text-foreground">{limit.label}</span><span className="font-mono text-sm font-semibold text-foreground">{limit.value}</span></div>)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleStartTrial} disabled={loading} className="bg-core text-white hover:bg-core/90">{loading ? 'Starting...' : 'Start free trial'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
