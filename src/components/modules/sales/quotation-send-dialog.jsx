'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, FileDown, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// The Send dialog for a quotation, used by the quotation form and the quotation page.
// Step 1: choose Email or PDF. Step 2 (email only): recipient and message.
// The caller does the work (save it, record the send, open the mail app / print view):
//   onEmail({ email, message })  -> Promise, throw/reject on failure (the caller toasts)
//   onExport()                   -> Promise
export default function QuotationSendDialog({
  open,
  onOpenChange,
  quoteLabel = 'this quotation',
  defaultEmail = '',
  summaryLines = [],
  onEmail,
  onExport,
}) {
  const [mode, setMode] = useState('choose')
  const [email, setEmail] = useState(defaultEmail)
  const [message, setMessage] = useState('Please find our quotation below.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMode('choose')
      setEmail((current) => current || defaultEmail)
    }
  }, [open, defaultEmail])

  const close = (next) => {
    if (busy) return
    onOpenChange(next)
  }

  const runEmail = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await onEmail({ email: email.trim(), message })
    } catch {
      // the caller already showed the error
    } finally {
      setBusy(false)
    }
  }

  const runExport = async () => {
    setBusy(true)
    try {
      await onExport()
    } catch {
      // the caller already showed the error
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{mode === 'email' ? 'Send by email' : `Send ${quoteLabel}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'email'
              ? 'It is marked as sent, then your email app opens with the message ready.'
              : 'Choose how to send it. Either way it is marked as sent.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mode === 'choose' ? (
          <>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={busy} className="h-auto justify-start gap-3 px-4 py-3 text-left" onClick={() => setMode('email')}>
                <Mail className="size-5 text-core" />
                <span>
                  <span className="block text-xs font-semibold">Send by email</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Email it to the customer.</span>
                </span>
              </Button>
              <Button type="button" variant="outline" disabled={busy} className="h-auto justify-start gap-3 px-4 py-3 text-left" onClick={runExport}>
                <FileDown className="size-5 text-core" />
                <span>
                  <span className="block text-xs font-semibold">{busy ? 'Working...' : 'Export as PDF'}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Open the printable copy.</span>
                </span>
              </Button>
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <form onSubmit={runEmail} className="flex flex-col gap-3">
            <Button type="button" variant="ghost" className="h-6 w-fit gap-1 px-0 text-xs text-muted-foreground" disabled={busy} onClick={() => setMode('choose')}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <label className="text-xs font-medium text-foreground">
              Recipient email
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" className="mt-1" />
            </label>
            <label className="text-xs font-medium text-foreground">
              Message
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 min-h-20 text-xs" />
            </label>
            {summaryLines.length > 0 && (
              <div className="rounded-sm border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {summaryLines.map((line) => <p key={line}>{line}</p>)}
              </div>
            )}
            <AlertDialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" className="bg-core text-white" disabled={busy}>{busy ? 'Sending...' : 'Send'}</Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
