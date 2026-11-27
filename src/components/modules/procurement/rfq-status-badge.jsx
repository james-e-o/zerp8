const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  lost: 'bg-amber-100 text-amber-800',
  converted: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function RfqStatusBadge({ status }) {
  const label = status ? `${status[0].toUpperCase()}${status.slice(1)}` : 'Unknown'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}
