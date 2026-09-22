import { STATUS_STYLES, formatStatusLabel } from './dummy-data'

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {formatStatusLabel(status)}
    </span>
  )
}
