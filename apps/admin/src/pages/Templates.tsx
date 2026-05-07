import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface TemplateMeta {
  id: string;
  description: string;
  sourceType: string;
}

export function TemplatesPage() {
  const q = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<TemplateMeta[]>("/api/templates"),
  });

  return (
    <div>
      <PageHeader title="Templates" />
      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyList title="No templates registered" />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {q.data.map((t) => (
            <li key={t.id}>
              <Link
                to={`/templates/${t.id}/preview`}
                className="block px-4 py-3 hover:bg-zinc-900/40"
              >
                <p className="text-sm font-medium text-zinc-100">{t.id}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{t.description}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  source type:{" "}
                  <span className="font-mono">{t.sourceType}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
