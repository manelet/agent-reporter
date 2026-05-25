import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { NotificationLogRecord } from "@agent-reporter/shared";
import { Button } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface LogsResponse {
  items: NotificationLogRecord[];
  page: number;
  perPage: number;
  totalItems: number;
}

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-950 text-emerald-300",
  failed: "bg-red-950 text-red-300",
};

export function LogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-logs", page],
    queryFn: () =>
      api.get<LogsResponse>(
        `/api/notification-logs?page=${page}&perPage=50`,
      ),
  });

  const totalPages = data ? Math.ceil(data.totalItems / data.perPage) : 0;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Notification logs" />

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !data || data.items.length === 0 ? (
        <EmptyList
          title="No notifications yet"
          hint="Send a notification via POST /api/notify to see it logged here."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Recipient</th>
                  <th className="px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-400">
                      {new Date(log.created).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{log.channel}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[log.status] ?? ""}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-zinc-100">
                      {log.notification?.title ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">
                      {log.recipient ?? "default"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-xs text-red-400">
                      {log.error ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                Page {page} of {totalPages} ({data.totalItems} total)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
