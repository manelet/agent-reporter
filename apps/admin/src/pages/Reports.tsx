import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ReportRecord } from "@agent-reporter/shared";
import { Button } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

export function ReportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportRecord[]>("/api/reports"),
  });

  const runNow = useMutation({
    mutationFn: (id: string) =>
      api.post<{ runId: string; status: string }>(
        `/api/reports/${id}/run`,
        {},
      ),
    onMutate: (id) => setRunning(id),
    onSettled: () => setRunning(null),
    onSuccess: (res) => {
      setFeedback(`Run finished: ${res.status}`);
      qc.invalidateQueries({ queryKey: ["runs"] });
      navigate(`/runs/${res.runId}`);
    },
    onError: (e) =>
      setFeedback(e instanceof Error ? `Run failed: ${e.message}` : "Run failed"),
  });

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <Link to="/reports/new">
            <Button variant="primary">New report</Button>
          </Link>
        }
      />
      {feedback ? (
        <p className="mb-4 text-xs text-zinc-400">{feedback}</p>
      ) : null}
      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyList
          title="No reports yet"
          hint="A report ties a source to one or more channels with a trigger (cron or webhook)."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {q.data.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <Link to={`/reports/${r.id}/edit`} className="flex-1 pr-4">
                <p className="text-sm font-medium text-zinc-100">{r.name}</p>
                <p className="text-xs text-zinc-500">
                  {r.template_id} · {r.trigger}
                  {r.cron ? ` · ${r.cron}` : ""}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    r.enabled
                      ? "bg-emerald-900/40 text-emerald-300"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {r.enabled ? "enabled" : "disabled"}
                </span>
                <Button
                  type="button"
                  disabled={running === r.id}
                  onClick={() => runNow.mutate(r.id)}
                >
                  {running === r.id ? "Running…" : "Run now"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
