import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { RunRecord } from "@agent-reporter/shared";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface RunsResponse {
  items: RunRecord[];
  totalItems: number;
}

const statusStyles: Record<RunRecord["status"], string> = {
  success: "bg-emerald-900/40 text-emerald-300",
  partial: "bg-amber-900/40 text-amber-300",
  skipped: "bg-zinc-800 text-zinc-400",
  failed: "bg-red-900/40 text-red-300",
};

export function RunsPage() {
  const q = useQuery({
    queryKey: ["runs"],
    queryFn: () => api.get<RunsResponse>("/api/runs"),
  });

  return (
    <div>
      <PageHeader title="Runs" />
      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !q.data || q.data.items.length === 0 ? (
        <EmptyList
          title="No runs yet"
          hint="Runs appear here once a report fires (cron or webhook)."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {q.data.items.map((r) => (
            <li key={r.id}>
              <Link
                to={`/runs/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/40"
              >
                <div>
                  <p className="font-mono text-xs text-zinc-400">{r.id}</p>
                  <p className="text-xs text-zinc-500">
                    {r.trigger_kind} ·{" "}
                    {r.started_at
                      ? new Date(r.started_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${statusStyles[r.status]}`}
                >
                  {r.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
