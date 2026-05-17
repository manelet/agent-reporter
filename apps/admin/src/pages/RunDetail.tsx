import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { RunRecord } from "@agent-reporter/shared";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

const statusStyles: Record<RunRecord["status"], string> = {
  success: "bg-emerald-900/40 text-emerald-300",
  partial: "bg-amber-900/40 text-amber-300",
  skipped: "bg-zinc-800 text-zinc-400",
  failed: "bg-red-900/40 text-red-300",
};

export function RunDetailPage() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["run", id],
    queryFn: () => api.get<RunRecord>(`/api/runs/${id}`),
    enabled: !!id,
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Run detail"
        actions={
          <Link to="/runs" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← back to runs
          </Link>
        }
      />

      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error || !q.data ? (
        <p className="text-sm text-red-400">Failed to load run.</p>
      ) : (
        <div className="space-y-6">
          <Section title="Summary">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-zinc-500">Status</dt>
              <dd>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${statusStyles[q.data.status]}`}
                >
                  {q.data.status}
                </span>
              </dd>
              <dt className="text-zinc-500">Trigger</dt>
              <dd className="text-zinc-200">{q.data.trigger_kind}</dd>
              <dt className="text-zinc-500">Report</dt>
              <dd className="font-mono text-xs text-zinc-300">
                {q.data.report ?? <span className="text-zinc-500">— (direct API call)</span>}
              </dd>
              <dt className="text-zinc-500">Started</dt>
              <dd className="text-zinc-200">
                {q.data.started_at
                  ? new Date(q.data.started_at).toLocaleString()
                  : "—"}
              </dd>
              <dt className="text-zinc-500">Finished</dt>
              <dd className="text-zinc-200">
                {q.data.finished_at
                  ? new Date(q.data.finished_at).toLocaleString()
                  : "—"}
              </dd>
            </dl>
          </Section>

          {q.data.error ? (
            <Section title="Error">
              <pre className="whitespace-pre-wrap rounded bg-red-950/40 p-3 text-xs text-red-200">
                {q.data.error}
              </pre>
            </Section>
          ) : null}

          {q.data.deliveries && q.data.deliveries.length > 0 ? (
            <Section title="Deliveries">
              <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
                {q.data.deliveries.map((d, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-mono text-xs text-zinc-300">
                        {d.channel_id}
                      </p>
                      {d.error ? (
                        <p className="mt-1 text-xs text-red-300">{d.error}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        d.status === "ok"
                          ? "bg-emerald-900/40 text-emerald-300"
                          : "bg-red-900/40 text-red-300"
                      }`}
                    >
                      {d.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {q.data.notification ? (
            <Section title={`Notification: ${q.data.notification.title}`}>
              <pre className="max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
                {JSON.stringify(q.data.notification, null, 2)}
              </pre>
            </Section>
          ) : null}

          <Section title="Raw payload">
            <pre className="max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {JSON.stringify(q.data.payload, null, 2)}
            </pre>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-zinc-300">{title}</h2>
      {children}
    </section>
  );
}
