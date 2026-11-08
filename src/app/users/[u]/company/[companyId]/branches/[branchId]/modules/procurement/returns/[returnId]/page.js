'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'
import { useVariantNames } from '@/components/modules/procurement/purchase-catalog'
import {
  Notice,
  Pill,
  RESOLUTION_LABELS,
  ReturnStatusPill,
  SectionCard,
  Stat,
  formatDate,
  inputClass,
  messageOf,
  useMoney,
} from '@/components/modules/procurement/supplier-credit-shared'

//   draft             change quantities / remove items, Submit, Cancel
//   pending approval  Approve or Reject (needs purchases "approve")
//   approved          Dispatch (needs inventory edit) - the goods leave
//   dispatched        the OUTCOME: what the supplier is doing about it, the
//                     money recovered so far, and links to record a credit
//                     note / debit note / refund, or receive the goods back
//                     if the supplier refused them
// Every button calls a database function; the database re-checks who is
// allowed and which step the return is on, so the buttons here only hide
// what you cannot do.

const OUTCOME_CHOICES = [
  { value: 'credit_note', label: 'Credit note' },
  { value: 'refund', label: 'Cash refund' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'write_off', label: 'Write off (supplier does nothing)' },
]

const CONFIRM_TEXT = {
  submit: {
    title: 'Submit this return?',
    body: 'It goes for approval if your settings require it; otherwise it is approved straight away. Stock lines are set aside once it is approved.',
    button: 'Submit',
  },
  cancel: {
    title: 'Cancel this return?',
    body: 'Anything set aside for it is released. The goods stay where they are.',
    button: 'Cancel return',
  },
  dispatch: {
    title: 'Dispatch these goods?',
    body: 'The goods leave our stock for good: quantities drop from quarantine or available stock and this cannot be undone.',
    button: 'Dispatch',
  },
  receive_back: {
    title: 'The supplier refused these goods?',
    body: 'The goods come back into quarantine, where you can accept them, return them again or write them off. The return is marked "refused by supplier".',
    button: 'Receive back',
  },
}

export default function Page() {
  const { u, companyId, branchId, returnId } = useParams()
  const money = useMoney()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`

  const [ret, setRet] = useState(null)
  const [lines, setLines] = useState([])
  const [reservedLines, setReservedLines] = useState({})
  const [recovery, setRecovery] = useState(null)
  const [credits, setCredits] = useState([])
  const [refunds, setRefunds] = useState([])
  const [settings, setSettings] = useState(null)
  const [can, setCan] = useState({ edit: false, approve: false, stock: false })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState(null)

  const [qtyEdits, setQtyEdits] = useState({})
  const [working, setWorking] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [note, setNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [outcome, setOutcome] = useState('')

  const { names: variantNames } = useVariantNames(lines.map((line) => line.variant))

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('purchase_returns')
      .select(
        `id, return_number, status, resolution, reason, supplier_reference, created_at, submitted_at,
         approved_at, rejected_at, rejection_reason, dispatched_at, dispatch_note, cancelled_at, supplier,
         supplier_row:suppliers ( id, name ),
         purchase_return_line_items (
           id, source, variant, quantity, unit_cost_snapshot, line_total, hold,
           holds:purchase_receipt_holds ( kind ),
           receipt_line:purchase_receipt_line_items ( purchase_receipt:purchase_receipts ( receipt_number ) )
         )`
      )
      .eq('id', returnId)
      .eq('branch', branchId)
      .maybeSingle()

    if (error || !data) {
      setErrorMessage(error?.message || 'Return not found.')
      toast.error(error?.message || 'Return not found.')
      setLoading(false)
      return
    }

    const [reservedRes, recoveryRes, creditRes, refundRes, settingsRes, editRes, approveRes, stockRes] = await Promise.all([
      supabase.from('inventory_reservations').select('reference_line, quantity').eq('reason', 'purchase_return').eq('reference_id', returnId),
      supabase.from('purchase_return_recovery').select('value, credited, refunded, recovered, outstanding, is_awaiting').eq('purchase_return', returnId).maybeSingle(),
      supabase.from('supplier_credit_returns').select('id, amount, credit:supplier_credits ( id, credit_number, kind, status )').eq('purchase_return', returnId),
      supabase.from('supplier_refund_returns').select('id, amount, refund:supplier_refunds ( id, refund_date, method, reference )').eq('purchase_return', returnId),
      supabase.rpc('get_effective_purchase_settings', { p_branch: branchId }),
      supabase.rpc('can_access_purchase_resource', { p_branch: branchId, p_verb: 'edit' }),
      supabase.rpc('can_access_purchase_resource', { p_branch: branchId, p_verb: 'approve' }),
      supabase.rpc('can_access_inventory_resource', { p_branch: branchId, p_verb: 'edit' }),
    ])

    setRet(data)
    setLines(data.purchase_return_line_items || [])
    setReservedLines(Object.fromEntries((reservedRes.data || []).map((row) => [row.reference_line, Number(row.quantity)])))
    setRecovery(recoveryRes.data || null)
    setCredits(creditRes.data || [])
    setRefunds(refundRes.data || [])
    setSettings(settingsRes.data || null)
    setCan({
      edit: editRes.data === true,
      approve: approveRes.data === true,
      stock: stockRes.data === true,
    })
    setOutcome(OUTCOME_CHOICES.some((choice) => choice.value === data.resolution) ? data.resolution : '')
    setQtyEdits({})
    setLoading(false)
  }, [returnId, branchId])

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn, args, successText) => {
    setWorking(true)
    setResult(null)
    const { error } = await supabase.rpc(fn, args)
    setWorking(false)
    setConfirm(null)
    if (error) {
      setResult({ ok: false, lines: [messageOf(error)] })
      toast.error(messageOf(error))
      return false
    }
    setResult({ ok: true, lines: [successText] })
    toast.success(successText)
    setNote('')
    load()
    return true
  }

  const runConfirmed = () => {
    if (confirm === 'submit') return run('submit_purchase_return', { p_return: returnId }, 'Return submitted.')
    if (confirm === 'cancel') return run('cancel_purchase_return', { p_return: returnId }, 'Return cancelled.')
    if (confirm === 'dispatch')
      return run('dispatch_purchase_return', { p_return: returnId, p_note: note.trim() || null }, 'Goods dispatched.')
    if (confirm === 'receive_back')
      return run('receive_back_rejected_return', { p_return: returnId, p_note: note.trim() || null }, 'Goods received back into quarantine.')
  }

  if (loading && !ret) return <p className="p-4 text-xs text-muted-foreground">Loading return...</p>

  if (errorMessage || !ret) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/returns`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <div role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage || 'Return not found.'}
        </div>
      </div>
    )
  }

  const supplierId = ret.supplier_row?.id || ret.supplier
  const supplierBase = `${base}/suppliers/${supplierId}`
  const total = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0)
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const isDraft = ret.status === 'draft'
  const direct =
    settings && !settings.returns_require_approval && !settings.returns_require_authorization_before_completing
  const canDispatch = can.stock && (ret.status === 'approved' || (isDraft && direct))
  const closedResolution = ['rejected', 'debit_note'].includes(ret.resolution)

  return (
    <div className="space-y-4 px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`${base}/returns`}>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">{ret.return_number}</h1>
          <ReturnStatusPill status={ret.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && can.edit && (
            <>
              <Link href={`${base}/returns/new?supplier=${supplierId}`}>
                <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">Add items</Button>
              </Link>
              <Button
                type="button"
                size="sm"
                className="h-7 rounded-sm bg-core text-xs text-white hover:bg-core/90"
                disabled={working || lines.length === 0}
                onClick={() => setConfirm('submit')}
              >
                Submit
              </Button>
            </>
          )}
          {canDispatch && (
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-sm bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={() => setConfirm('dispatch')}
            >
              Dispatch goods
            </Button>
          )}
          {['draft', 'pending_approval', 'approved'].includes(ret.status) && can.edit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-sm text-xs"
              disabled={working}
              onClick={() => setConfirm('cancel')}
            >
              Cancel return
            </Button>
          )}
        </div>
      </div>

      <Notice result={result} onDismiss={() => setResult(null)} />

      {isDraft && ret.rejection_reason && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
          Sent back by the approver: {ret.rejection_reason}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-sm border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">Supplier</p>
          <p className="mt-1 text-sm font-semibold">
            <Link href={supplierBase} className="text-core hover:underline">{ret.supplier_row?.name || '—'}</Link>
          </p>
        </div>
        <Stat label="Units" value={units.toLocaleString()} />
        <Stat label="Worth" value={money(total)} />
        <Stat
          label="Expecting"
          value={RESOLUTION_LABELS[ret.resolution] || '—'}
          hint={ret.reason || undefined}
        />
      </div>

      {ret.status === 'pending_approval' && can.approve && (
        <SectionCard title="Approval">
          <div className="space-y-3 p-4">
            <p className="text-muted-foreground">
              Approving sets the stock lines aside so nobody else can sell or return them, and lets the
              goods be dispatched.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Reason (used if you send it back)"
              className="min-h-14 text-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-core text-xs text-white hover:bg-core/90"
                disabled={working}
                onClick={() => run('decide_purchase_return', { p_return: returnId, p_approve: true }, 'Return approved.')}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={working}
                onClick={() =>
                  run(
                    'decide_purchase_return',
                    { p_return: returnId, p_approve: false, p_reason: rejectReason.trim() || null },
                    'Sent back to draft.'
                  )
                }
              >
                Send back
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
      {ret.status === 'pending_approval' && !can.approve && (
        <p className="rounded-sm border border-border bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
          Waiting for someone with approval rights.
        </p>
      )}

      <SectionCard title="Items">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-left font-medium">From</th>
              <th className="px-4 py-2 text-left font-medium">Receipt</th>
              <th className="px-4 py-2 text-right font-medium">Quantity</th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              {isDraft && can.edit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => {
              const edit = qtyEdits[line.id]
              const changed = edit !== undefined && Number(edit) !== Number(line.quantity)
              return (
                <tr key={line.id}>
                  <td className="px-4 py-2 text-foreground">{variantNames[line.variant]?.display || '—'}</td>
                  <td className="px-4 py-2">
                    {line.source === 'quarantine' ? (
                      <Pill className="bg-orange-100 text-orange-800">Quarantine</Pill>
                    ) : (
                      <Pill className="bg-gray-100 text-gray-700">Available stock</Pill>
                    )}
                    {reservedLines[line.id] > 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">reserved for this return</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {line.receipt_line?.purchase_receipt?.receipt_number || '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isDraft && can.edit ? (
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={edit ?? line.quantity}
                        onChange={(event) => setQtyEdits((prev) => ({ ...prev, [line.id]: event.target.value }))}
                        className="ml-auto h-7 w-20 text-right text-xs"
                      />
                    ) : (
                      Number(line.quantity).toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{line.unit_cost_snapshot == null ? '—' : money(line.unit_cost_snapshot)}</td>
                  <td className="px-4 py-2 text-right">{line.line_total == null ? '—' : money(line.line_total)}</td>
                  {isDraft && can.edit && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {changed && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 bg-core text-[11px] text-white hover:bg-core/90"
                            disabled={working}
                            onClick={() =>
                              run('set_purchase_return_line_quantity', { p_line: line.id, p_quantity: Number(edit) }, 'Quantity updated.')
                            }
                          >
                            Save
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px]"
                          disabled={working}
                          onClick={() => run('set_purchase_return_line_quantity', { p_line: line.id, p_quantity: 0 }, 'Item removed.')}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {lines.length === 0 && <p className="p-4 text-muted-foreground">No items on this return.</p>}
      </SectionCard>

      {ret.status === 'dispatched' && (
        <SectionCard title="Outcome - what the supplier is doing about it">
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Worth" value={money(recovery?.value ?? total)} />
              <Stat label="Credited" value={money(recovery?.credited)} />
              <Stat label="Refunded" value={money(recovery?.refunded)} />
              <Stat
                label="Still to recover"
                value={money(recovery?.outstanding)}
                tone={recovery?.is_awaiting ? 'bad' : undefined}
              />
            </div>

            {closedResolution ? (
              <p className="rounded-sm border border-border bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
                {ret.resolution === 'rejected'
                  ? 'The supplier refused this return and the goods came back into quarantine.'
                  : 'We issued our own debit note for this return.'}
              </p>
            ) : (
              can.edit && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground">We expect</span>
                    <select value={outcome} onChange={(event) => setOutcome(event.target.value)} className={`${inputClass} mt-1 w-64`}>
                      <option value="" disabled>Choose...</option>
                      {OUTCOME_CHOICES.filter(
                        (choice) => !(choice.value === 'refund' && settings?.returns_require_credit_note)
                      ).map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={working || !outcome || outcome === ret.resolution}
                    onClick={() => run('set_purchase_return_resolution', { p_return: returnId, p_resolution: outcome }, 'Outcome updated.')}
                  >
                    Save
                  </Button>
                </div>
              )
            )}

            {!closedResolution && can.edit && (
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`${supplierBase}/credits/new?type=credit_note&return=${returnId}`}>
                  <Button type="button" size="sm" className="h-7 bg-core text-xs text-white hover:bg-core/90">Record credit note</Button>
                </Link>
                <Link href={`${supplierBase}/credits/new?type=debit_note&return=${returnId}`}>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs">Issue our debit note</Button>
                </Link>
                {!settings?.returns_require_credit_note && (
                  <Link href={`${supplierBase}/refunds/new?return=${returnId}`}>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs">Record refund</Button>
                  </Link>
                )}
                {can.stock && credits.length === 0 && refunds.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={working}
                    onClick={() => setConfirm('receive_back')}
                  >
                    Supplier refused - receive goods back
                  </Button>
                )}
              </div>
            )}

            {(credits.length > 0 || refunds.length > 0) && (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {credits.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2">
                        <Link href={`${supplierBase}/credits/${row.credit?.id}`} className="font-medium text-core hover:underline">
                          {row.credit?.credit_number}
                        </Link>
                        {row.credit?.kind === 'debit_note' && <span className="ml-1.5 text-[10px] text-amber-700">our debit note</span>}
                        {row.credit?.status === 'void' && <span className="ml-1.5 text-[10px] text-red-600">void</span>}
                      </td>
                      <td className="py-2 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                  {refunds.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 text-muted-foreground">
                        Refund {formatDate(row.refund?.refund_date)} {row.refund?.method ? `- ${row.refund.method}` : ''}
                        {row.refund?.reference ? ` (${row.refund.reference})` : ''}
                      </td>
                      <td className="py-2 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title="History">
        <ul className="space-y-1 p-4 text-muted-foreground">
          <li>Created {formatDate(ret.created_at)}</li>
          {ret.submitted_at && <li>Submitted {formatDate(ret.submitted_at)}</li>}
          {ret.approved_at && <li>Approved {formatDate(ret.approved_at)}</li>}
          {ret.rejected_at && <li>Sent back {formatDate(ret.rejected_at)}{ret.rejection_reason ? `: ${ret.rejection_reason}` : ''}</li>}
          {ret.dispatched_at && (
            <li>
              Dispatched {formatDate(ret.dispatched_at)}
              {ret.dispatch_note ? `: ${ret.dispatch_note}` : ''}
            </li>
          )}
          {ret.cancelled_at && <li>Cancelled {formatDate(ret.cancelled_at)}</li>}
        </ul>
      </SectionCard>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !working && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{confirm ? CONFIRM_TEXT[confirm].title : ''}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">{confirm ? CONFIRM_TEXT[confirm].body : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          {(confirm === 'dispatch' || confirm === 'receive_back') && (
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={confirm === 'dispatch' ? 'Note (courier, waybill number...)' : 'Note (optional)'}
              className="min-h-14 text-xs"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>Back</AlertDialogCancel>
            {/* No preventDefault on purpose: the dialog closes itself and run() shows the outcome above. */}
            <AlertDialogAction className="h-7 bg-core text-xs text-white hover:bg-core/90" disabled={working} onClick={runConfirmed}>
              {confirm ? CONFIRM_TEXT[confirm].button : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
