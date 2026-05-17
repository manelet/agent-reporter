import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiKeyRecord } from "@agent-reporter/shared";
import { Button } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface CreatedKey extends ApiKeyRecord {
  token: string;
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKeyRecord[]>("/api/api-keys"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<CreatedKey>("/api/api-keys", { name: "global" }),
    onSuccess: (k) => {
      setRevealed(k);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "create failed"),
  });

  const rotate = useMutation({
    mutationFn: (id: string) =>
      api.post<CreatedKey>(`/api/api-keys/${id}/rotate`, {}),
    onSuccess: (k) => {
      setRevealed(k);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "rotate failed"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/api/api-keys/${id}/revoke`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: (e) => setErr(e instanceof Error ? e.message : "revoke failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="API keys"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setErr(null);
              create.mutate();
            }}
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "New API key"}
          </Button>
        }
      />

      <p className="mb-4 text-xs text-zinc-500">
        Bearer tokens for <code className="text-zinc-300">POST /api/notify</code>.
        The plaintext is shown once on creation/rotation; only its SHA-256 hash
        is stored.
      </p>

      {revealed ? (
        <div className="mb-6 rounded border border-emerald-800 bg-emerald-950/40 p-4">
          <p className="mb-2 text-xs font-medium text-emerald-200">
            New token (save it now — it won't be shown again)
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={revealed.token}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded border border-emerald-700 bg-emerald-950/60 px-3 py-1.5 font-mono text-xs text-emerald-100 outline-none"
            />
            <Button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(revealed.token).catch(() => {});
              }}
            >
              Copy
            </Button>
            <Button type="button" onClick={() => setRevealed(null)}>
              Hide
            </Button>
          </div>
        </div>
      ) : null}

      {err ? <p className="mb-4 text-sm text-red-400">{err}</p> : null}

      {list.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : list.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyList
          title="No API keys yet"
          hint="Create one to enable POST /api/notify from your scripts."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {list.data.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-100">{k.name}</p>
                <p className="text-xs text-zinc-500">
                  Created {new Date(k.created).toLocaleString()}
                  {k.last_used_at
                    ? ` · last used ${new Date(k.last_used_at).toLocaleString()}`
                    : " · never used"}
                  {k.revoked_at ? " · revoked" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {k.revoked_at ? (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    revoked
                  </span>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setErr(null);
                      rotate.mutate(k.id);
                    }}
                    disabled={rotate.isPending}
                  >
                    Rotate
                  </Button>
                )}
                {!k.revoked_at ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (confirm("Revoke this key? It will stop working.")) {
                        revoke.mutate(k.id);
                      }
                    }}
                  >
                    Revoke
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (confirm("Delete this key permanently?")) {
                      remove.mutate(k.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
