import type { ReactNode } from "react";

interface Props {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: Props) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
