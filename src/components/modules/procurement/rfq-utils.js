import supabase from '@/config/supabaseClient'

export async function callRfqRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (result?.success === false) {
    throw new Error(result.error || `The ${name} request failed.`)
  }
  return result
}

export function getRfqId(result) {
  return result?.rfq?.id ?? result?.rfq_id ?? result?.new_rfq_id ?? result?.id ?? result?.data?.id ?? null
}

export function formatRfqDate(value) {
  if (!value) return '—'
  const datePart = String(value).slice(0, 10)
  const date = new Date(`${datePart}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export function isRfqDueSoon(replyBy) {
  if (!replyBy) return false
  const today = new Date()
  const [year, month, day] = String(replyBy).slice(0, 10).split('-').map(Number)
  const deadline = Date.UTC(year, month - 1, day)
  const todayDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const daysUntil = Math.round((deadline - todayDate) / 86400000)
  return daysUntil >= 0 && daysUntil <= 2
}

export function getCreatorName(row) {
  return (
    row?.creator_name ||
    row?.creator_full_name ||
    row?.created_by_name ||
    row?.created_by_user?.full_name ||
    row?.created_by_user?.name ||
    row?.created_by?.full_name ||
    row?.created_by?.name ||
    row?.created_by_staff?.full_name ||
    row?.created_by_staff?.name ||
    row?.creator?.full_name ||
    row?.creator?.name ||
    '—'
  )
}

export function lineHasQuotedPrice(line) {
  return line?.quoted_unit_cost !== null &&
    line?.quoted_unit_cost !== undefined &&
    line?.quoted_unit_cost !== ''
}

export function isRfqReadyToConvert(lines) {
  return lines.length > 0 && lines.every(lineHasQuotedPrice)
}

export function getRpcErrorMessage(error, fallback) {
  return error?.message || fallback
}
