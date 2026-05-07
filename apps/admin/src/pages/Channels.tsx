import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ChannelRecord } from "@agent-reporter/shared";
import { Button } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

export function ChannelsPage() {
  const q = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.get<ChannelRecord[]>("/api/channels"),
  });

  return (
    <div>
      <PageHeader
        title="Channels"
        actions={
          <Link to="/channels/new">
            <Button variant="primary">New channel</Button>
          </Link>
        }
      />
      {q.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyList
          title="No channels yet"
          hint="Channels deliver reports — Telegram for now, email coming in M3."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {q.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/channels/${s.id}/edit`}
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
