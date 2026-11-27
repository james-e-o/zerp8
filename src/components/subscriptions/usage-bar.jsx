export default function UsageBar({ name, current, max, unit }) {
  const percent = max ? Math.min(100, Math.round((current / max) * 100)) : 0
  return <div className="border-b border-gray-100 py-2.5 last:border-0"><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium text-gray-800">{name}</span><span className="shrink-0 text-gray-600">{current.toLocaleString()} / {max.toLocaleString()} {unit}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-yellow-500' : 'bg-core'}`} style={{ width: `${percent}%` }} /></div></div>
}
