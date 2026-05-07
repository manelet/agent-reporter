import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface PreviewResponse {
  data: unknown;
  shouldDeliver: boolean;
  email: { subject: string; html: string };
  telegram: string;
}

export function TemplatePreviewPage() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["template-preview", id],
    queryFn: () => api.get<PreviewResponse>(`/api/templates/${id}/preview`),
    enabled: !!id,
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Preview · ${id}`}
        actions={
          <Link
            to="/templates"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← back to templates
          </Link>
        }
      />

      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error || !q.data ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-zinc-400">
            Renderered with mock data.{" "}
            <span
              className={
                q.data.shouldDeliver
                  ? "text-emerald-300"
                  : "text-zinc-400"
              }
            >
              shouldDeliver: {String(q.data.shouldDeliver)}
            </span>
          </p>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-300">
              Email · {q.data.email.subject}
            </h2>
            <iframe
              title="email-preview"
              srcDoc={q.data.email.html}
              className="h-96 w-full rounded border border-zinc-800 bg-white"
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-300">
              Telegram
            </h2>
            <pre className="whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
              {q.data.telegram}
            </pre>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-300">
              Mock data
            </h2>
            <pre className="max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {JSON.stringify(q.data.data, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
