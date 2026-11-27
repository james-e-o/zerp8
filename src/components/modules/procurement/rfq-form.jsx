'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePurchaseCatalog, useSuppliers } from '@/components/modules/procurement/purchase-catalog'
import RfqLineItemsTable from '@/components/modules/procurement/rfq-line-items-table'
import { callRfqRpc, getRfqId } from '@/components/modules/procurement/rfq-utils'
import supabase from '@/config/supabaseClient'

const blankLine = () => ({ variantId: '', quantity: 1, notes: '' })

export default function RfqForm({ rfqId = null }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/rfqs`
  const [name, setName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [currency, setCurrency] = useState(currentBranch?.base_currency || '')
  const [replyBy, setReplyBy] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [items, setItems] = useState([blankLine()])
  const [loading, setLoading] = useState(Boolean(rfqId))
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { suppliers, loading: suppliersLoading, error: suppliersError } = useSuppliers(companyId)
  const { catalog, loading: catalogLoading, error: catalogError } = usePurchaseCatalog(branchId)

  const duplicateProductKeys = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => {
      if (!item.variantId) return
      const productKey = catalog.find((variant) => variant.id === item.variantId)?.productId || item.variantId
      counts.set(productKey, (counts.get(productKey) || 0) + 1)
    })
    return [...counts].filter(([, count]) => count > 1).map(([id]) => id)
  }, [items, catalog])

  useEffect(() => {
    if (!currency && currentBranch?.base_currency) setCurrency(currentBranch.base_currency)
  }, [currency, currentBranch?.base_currency])

  useEffect(() => {
    if (catalogError) toast.error(catalogError)
  }, [catalogError])

  useEffect(() => {
    if (suppliersError) {
      console.error('Failed to load RFQ suppliers:', suppliersError)
      toast.error(suppliersError)
    }
  }, [suppliersError])

  useEffect(() => {
    if (!rfqId) return undefined
    let cancelled = false

    async function loadDraft() {
      setLoading(true)
      try {
        const { data: row, error } = await supabase
          .from('rfqs')
          .select('*')
          .eq('id', rfqId)
          .eq('branch', branchId)
          .maybeSingle()
        if (error) throw error
        if (!row) throw new Error('RFQ not found.')
        if (row.status !== 'draft') {
          router.replace(`${base}/${rfqId}`)
          throw new Error('Only draft RFQs can be edited.')
        }

        const { data: lineRows, error: linesError } = await supabase
          .from('rfq_line_items')
          .select('*')
          .eq('rfq', rfqId)
        if (linesError) throw linesError
        if (cancelled) return

        setName(row.name || '')
        setSupplierId(row.supplier || '')
        setCurrency(row.currency || currentBranch?.base_currency || '')
        setReplyBy(row.reply_by ? String(row.reply_by).slice(0, 10) : '')
        setNeededBy(row.needed_by ? String(row.needed_by).slice(0, 10) : '')
        setNotes(row.notes || '')
        setTerms(row.terms || '')
        setItems((lineRows || []).length
          ? lineRows.map((line) => ({
              variantId: line.variant || '',
              quantity: line.quantity ?? 1,
              notes: line.notes || '',
            }))
          : [blankLine()])
      } catch (error) {
        console.error('Failed to load RFQ draft:', error)
        if (!cancelled) {
          const message = error.message || 'Could not load this RFQ draft.'
          setSubmitError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [rfqId, branchId, base, currentBranch?.base_currency, router])

  const submit = async (complete) => {
    setSubmitError('')
    if (complete && (!name.trim() || !supplierId)) {
      const message = !name.trim() ? 'Enter an RFQ name.' : 'Select a supplier.'
      setSubmitError(message)
      toast.error(message)
      return
    }
    if (duplicateProductKeys.length > 0) {
      const message = 'Each product can appear only once on an RFQ.'
      setSubmitError(message)
      toast.error(message)
      return
    }

    setSaving(true)
    try {
      const result = await callRfqRpc('rfq_save', {
        p_branch: branchId,
        p_rfq: rfqId,
        p_fields: {
          name: name.trim() || null,
          supplier: supplierId || null,
          currency: currency || null,
          reply_by: replyBy || null,
          needed_by: neededBy || null,
          notes: notes || null,
          terms: terms || null,
        },
        p_lines: items
          .filter((item) => item.variantId)
          .map((item) => ({
            variant: item.variantId,
            quantity: Number(item.quantity),
            notes: item.notes || null,
          })),
        p_complete: complete,
      })

      const savedId = getRfqId(result) || rfqId
      if (!savedId) throw new Error('The saved RFQ did not return an RFQ ID.')

      if (complete) {
        toast.success('RFQ created')
        router.push(`${base}/${savedId}`)
      } else {
        toast.success('Draft saved')
        if (!rfqId) router.replace(`${base}/${savedId}/edit`)
      }
    } catch (error) {
      console.error('Failed to save RFQ:', error)
      const message = error.message || 'Could not save this RFQ.'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading RFQ draft...</p>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">
            {rfqId ? 'Edit RFQ draft' : 'New RFQ'}
          </h1>
          <p className="text-xs text-muted-foreground">Request prices from one supplier.</p>
        </div>
        <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      <form
        className="flex min-h-0 grow flex-col gap-3 overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          submit(true)
        }}
      >
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-medium text-foreground">
            Name <span className="text-red-500">*</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-8 text-xs" />
          </label>
          <label className="text-xs font-medium text-foreground">
            Supplier <span className="text-red-500">*</span>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{suppliersLoading ? 'Loading suppliers...' : 'Select supplier'}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-foreground">
            Reply by
            <Input type="date" value={replyBy} onChange={(event) => setReplyBy(event.target.value)} className="mt-1 h-8 text-xs" />
          </label>
          <label className="text-xs font-medium text-foreground">
            Needed by
            <Input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} className="mt-1 h-8 text-xs" />
          </label>
          <label className="text-xs font-medium text-foreground">
            Notes
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-8 text-xs" rows={1} />
          </label>
          <label className="text-xs font-medium text-foreground sm:col-span-2 lg:col-span-3">
            Terms
            <Textarea value={terms} onChange={(event) => setTerms(event.target.value)} className="mt-1 min-h-12 text-xs" rows={2} />
          </label>
        </div>

        <div className="flex min-h-0 grow flex-col overflow-hidden">
          {catalogError ? (
            <p className="text-xs text-red-600">{catalogError}</p>
          ) : catalogLoading ? (
            <p className="text-xs text-muted-foreground">Loading products...</p>
          ) : (
            <RfqLineItemsTable items={items} setItems={setItems} catalog={catalog} />
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => submit(false)}>
            {saving ? 'Saving...' : 'Save draft'}
          </Button>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving || catalogLoading}>
            {saving ? 'Creating...' : 'Create RFQ'}
          </Button>
        </div>
      </form>
    </div>
  )
}
