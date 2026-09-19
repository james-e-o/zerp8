'use client'

export default function BundleCard({ bundle, selected, onToggle, children }) {
  return (
    <div className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-core bg-core_light/40' : 'border-border bg-card hover:border-core/40'}`}>
      <button type="button" onClick={() => onToggle(bundle.id)} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 text-xs ${selected ? 'border-core bg-core text-white' : 'border-border'}`}>
          {selected ? '✓' : ''}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{bundle.name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{bundle.description}</span>
          <span className="mt-2 block text-xs text-core">{bundle.modules.join(' • ')}</span>
        </span>
      </button>
      {selected && children && <div className="ml-8 mt-4 border-t border-core/15 pt-4">{children}</div>}
    </div>
  )
}