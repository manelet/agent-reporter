interface Props {
  title: string;
  hint?: string;
}

export function EmptyList({ title, hint }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-10 text-center">
      <p className="text-sm text-zinc-300">{title}</p>
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
