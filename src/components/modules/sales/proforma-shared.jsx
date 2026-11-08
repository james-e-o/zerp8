'use client'

// Shared by the proforma list, form and detail pages.
// "Expired" is never stored: a saved or sent proforma whose valid-until date has passed.
export function isProformaExpired(proforma) {
  if (!proforma || !['saved', 'sent', 'draft'].includes(proforma.status) || !proforma.valid_until) return false
  const end = new Date(proforma.valid_until)
  if (Number.isNaN(end.getTime())) return false
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

const STYLES = {
  draft: ['Draft', 'bg-slate-100 text-slate-700'],
  saved: ['Saved', 'bg-slate-100 text-slate-700'],
  sent: ['Sent', 'bg-blue-50 text-blue-700'],
  converted: ['Converted', 'bg-emerald-50 text-emerald-700'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
  expired: ['Expired', 'bg-amber-50 text-amber-700'],
}

export function ProformaStatusPill({ proforma }) {
  const key = isProformaExpired(proforma) ? 'expired' : proforma?.status
  const [label, tone] = STYLES[key] || [key || '—', 'bg-slate-100 text-slate-700']
  return <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
}
