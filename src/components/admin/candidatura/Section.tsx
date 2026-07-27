export function Section({ title, items }: { title: string; items: [string, string | null | undefined][] }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}