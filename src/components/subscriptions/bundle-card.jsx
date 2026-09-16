'use client'

export default function BundleCard({ bundle, selected, onToggle, children }) {
  return (
    <div className={`w-full rounded-lg border-2 p-4 text-left transition ${selected ? 'border-core bg-core/5' : 'border-gray-200 bg-white hover:border-core/40'}`}>
      <button type="button" onClick={() => onToggle(bundle.id)} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 text-xs ${selected ? 'border-core bg-core text-white' : 'border-gray-300'}`}>
          {selected ? '✓' : ''}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900">{bundle.name}</span>
          <span className="mt-1 block text-xs text-gray-500">{bundle.description}</span>
          <span className="mt-2 block text-xs text-core">{bundle.modules.join(' • ')}</span>
        </span>
      </button>
      {selected && children && <div className="ml-8 mt-4 border-t border-core/15 pt-4">{children}</div>}
    </div>
  )
}
