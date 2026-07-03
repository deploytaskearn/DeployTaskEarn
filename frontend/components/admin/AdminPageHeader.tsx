export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-2xl md:text-3xl mb-1" style={{ color: "var(--color-surface)" }}>
        {title}
      </h1>
      {subtitle && <p className="text-sm" style={{ color: "rgba(245,242,234,0.55)" }}>{subtitle}</p>}
    </div>
  );
}
