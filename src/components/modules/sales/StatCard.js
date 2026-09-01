export default function StatCard({ label, value, sub, tone = "default" }) {
  const toneClass = {
    default: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];

  return (
    <div className="border border-line rounded-lg bg-surface p-4">
      <p className="text-xs font-medium text-inkmute uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-inkmute">{sub}</p>}
    </div>
  );
}
