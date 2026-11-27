'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { callRfqRpc } from '@/components/modules/procurement/rfq-utils'

export default function RfqSettingsPage() {
  const { branchId } = useParams()
  const [days, setDays] = useState('10')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setLoadError('')
      try {
        const result = await callRfqRpc('get_rfq_settings', { p_branch: branchId })
        const settings = Array.isArray(result) ? result[0] : result
        if (!cancelled) {
          setDays(String(settings?.default_expiry_days ?? 10))
        }
      } catch (error) {
        console.error('Failed to load RFQ settings:', error)
        if (!cancelled) {
          const message = error.message || 'Could not load RFQ settings.'
          setLoadError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (branchId) loadSettings()
    return () => {
      cancelled = true
    }
  }, [branchId, retryCount])

  const saveSettings = async (event) => {
    event.preventDefault()
    const value = Number(days)
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      toast.error('Enter a whole number from 1 to 365.')
      return
    }

    setSaving(true)
    try {
      await callRfqRpc('save_rfq_settings', { p_branch: branchId, p_days: value })
      toast.success('RFQ settings saved')
    } catch (error) {
      console.error('Failed to save RFQ settings:', error)
      toast.error(error.message || 'Could not save RFQ settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-xs text-muted-foreground">Loading RFQ settings...</p>
  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-red-600">{loadError}</p>
        <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setRetryCount((count) => count + 1)}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={saveSettings} className="max-w-2xl space-y-4 rounded-sm border border-border bg-card p-4">
      <div>
        <h1 className="text-sm font-semibold text-foreground">RFQ settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          An RFQ still Open after this many days becomes Lost. You can set a different reply-by date on each RFQ.
        </p>
      </div>
      <label className="block max-w-xs text-xs font-medium text-foreground">
        Default reply-by period (days)
        <Input
          type="number"
          min="1"
          max="365"
          step="1"
          value={days}
          disabled={loading}
          onChange={(event) => setDays(event.target.value)}
          className="mt-1 h-8 text-xs"
        />
      </label>
      <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={loading || saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </form>
  )
}
