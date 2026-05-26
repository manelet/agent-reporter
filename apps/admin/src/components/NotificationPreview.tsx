import type { Notification } from "@reporter/shared";

const LEVEL_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  success: "✅",
};

const LEVEL_COLOR: Record<string, string> = {
  info: "#0969da",
  warn: "#bf8700",
  error: "#cf222e",
  success: "#1a7f37",
};

export function TelegramPreview({ notification }: { notification: Notification }) {
  const emoji = LEVEL_EMOJI[notification.level ?? "info"];

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-400">Telegram</p>
      <div className="rounded-lg bg-zinc-950 p-4">
        <div className="max-w-sm rounded-xl rounded-tl-sm bg-[#2B5278] px-4 py-2.5 text-sm text-white shadow">
          <p className="mb-1 text-xs font-semibold text-[#6AB3F3]">Reporter</p>

          <p className="font-semibold">
            {emoji} {notification.title}
          </p>

          {notification.body ? (
            <p className="mt-1 text-zinc-200">{notification.body}</p>
          ) : null}

          {notification.sections?.map((s, i) => (
            <div key={i} className="mt-2">
              <p className="text-xs font-semibold text-zinc-300">{s.heading}</p>
              <ul className="mt-0.5 space-y-0.5">
                {s.items.map((item, j) => (
                  <li key={j} className="text-xs text-zinc-200">
                    {"• "}
                    {item.url ? (
                      <span className="text-[#6AB3F3]">{item.label}</span>
                    ) : (
                      item.label
                    )}
                    {" — "}
                    <span className="text-zinc-400">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {notification.metadata && notification.metadata.length > 0 ? (
            <div className="mt-2 rounded bg-black/20 px-2 py-1 font-mono text-xs text-zinc-300">
              {notification.metadata.map((m, i) => (
                <div key={i}>
                  {m.key}: {m.value}
                </div>
              ))}
            </div>
          ) : null}

          {notification.links?.map((l, i) => (
            <span key={i} className="mt-1 mr-2 inline-block text-xs text-[#6AB3F3]">
              {l.label} →
            </span>
          ))}

          <p className="mt-1 text-right text-[10px] text-zinc-400">
            12:34 ✓
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmailPreview({ notification }: { notification: Notification }) {
  const color = LEVEL_COLOR[notification.level ?? "info"];
  const emoji = LEVEL_EMOJI[notification.level ?? "info"];

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-400">Email</p>
      <div className="rounded-lg bg-zinc-300 p-4">
        <div className="mx-auto max-w-sm overflow-hidden rounded-lg bg-white shadow">
          <div
            className="px-4 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {emoji} {notification.title}
          </div>

          <div className="px-4 py-3 text-sm text-zinc-700">
            {notification.body ? (
              <p>{notification.body}</p>
            ) : null}

            {notification.sections?.map((s, i) => (
              <div key={i} className="mt-3">
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  {s.heading}
                </p>
                <ul className="mt-1 border-t border-zinc-100 pt-1">
                  {s.items.map((item, j) => (
                    <li key={j} className="py-0.5 text-xs">
                      {item.url ? (
                        <span className="text-blue-600">{item.label}</span>
                      ) : (
                        item.label
                      )}
                      {" — "}
                      <span className="text-zinc-400">{String(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {notification.metadata && notification.metadata.length > 0 ? (
              <table className="mt-3 w-full text-xs">
                <tbody>
                  {notification.metadata.map((m, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-1 pr-3 text-zinc-400">{m.key}</td>
                      <td className="py-1 text-zinc-600">{String(m.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {notification.links && notification.links.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-2">
                {notification.links.map((l, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium"
                    style={{ color }}
                  >
                    → {l.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
