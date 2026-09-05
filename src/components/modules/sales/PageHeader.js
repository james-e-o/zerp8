export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-3 border-line">
      <div>
        <h1 className="text-lg font-semibold text-core tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-inkmute max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
