'use client'

export default function BundleCard({ bundle, selected, onToggle, children }) {
  const isAvailable = bundle.status === 'active'
  const badgeLabel = bundle.status === 'coming_soon' ? 'Coming soon' : bundle.status === 'inactive' ? 'Unavailable' : null

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        !isAvailable
          ? 'border-border bg-muted/40 opacity-60 cursor-not-allowed'
          : selected
            ? 'border-core bg-core/5'
            : 'border-border bg-card'
      }`}
      // no onClick here at all
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!isAvailable}
          onChange={() => isAvailable && onToggle(bundle.id)}
          className="mt-1 accent-core disabled:cursor-not-allowed"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{bundle.name}</p>
            {badgeLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {badgeLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{bundle.description}</p>
          {bundle.modules?.length > 0 && (
            <p className="text-xs text-core mt-1">{bundle.modules.join(' • ')}</p>
          )}

          {isAvailable && selected && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  )
}