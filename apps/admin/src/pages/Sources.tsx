import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { SourceRecord } from "@agent-reporter/shared";
import { Button } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

export function SourcesPage() {
  const q = useQuery({
    queryKey: ["sources"],
    queryFn: () => api.get<SourceRecord[]>("/api/sources"),
  });

  return (
    <div>
      <PageHeader
        title="Sources"
        actions={
          <Link to="/sources/new">
            <Button variant="primary">New source</Button>
          </Link>
        }
      />
      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyList
          title="No sources yet"
          hint="Sources will let you fetch from Sentry, Mixpanel, GitHub Actions, or your own APIs."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {q.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/sources/${s.id}/edit`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/40"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-100">{s.name}</p>
                  <p className="text-xs text-zinc-500">{s.type}</p>
                </div>
                <span className="text-xs text-zinc-500">edit</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
