export default function UsageBar({ name, current, max, unit }) {
  const percent = max ? Math.min(100, Math.round((current / max) * 100)) : 0
  return <div className="border-b border-gray-100 py-3 last:border-0"><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-gray-800">{name}</span><span className="text-gray-600">{current.toLocaleString()} / {max.toLocaleString()} {unit}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-yellow-500' : 'bg-core'}`} style={{ width: `${percent}%` }} /></div></div>
}
