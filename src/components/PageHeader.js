export default function PageHeader({ title, description, action, navigation }) {
  return (
    <div className="border-line">
      <div className="flex items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-core tracking-tight">{title}</h1>
          {description && (
            <p className="-mt-0.5 text-xs text-inkmute max-w-xl">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0 ">{action}</div>}
      </div>
      {navigation}
    </div>
  );
}