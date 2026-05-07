import type PocketBase from "pocketbase";
import { getChannelAdapter } from "./channels/index.js";
import type { RenderedContent } from "./channels/types.js";
import { decryptConfig } from "./crypto.js";
import { getServerPb } from "./pb.js";
import { getSourceAdapter } from "./sources/index.js";
import type { TimeWindow } from "./sources/types.js";
import { getTemplate } from "./templates/index.js";

export type TriggerKind = "cron" | "webhook" | "manual";
export type RunStatus = "success" | "partial" | "skipped" | "failed";

interface DeliveryResult {
  channel_id: string;
  status: "ok" | "failed";
  error?: string;
}

interface RunOutcome {
  runId: string;
  status: RunStatus;
}

function last24hWindow(now = new Date()): TimeWindow {
  return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now };
}

export async function executeReport(
  reportId: string,
  triggerKind: TriggerKind,
  pbOverride?: PocketBase,
): Promise<RunOutcome> {
  const pb = pbOverride ?? (await getServerPb());
  const startedAt = new Date();

  const report = await pb.collection("reports").getOne(reportId);
  if (!report.enabled && triggerKind !== "manual") {
    throw new Error("report is disabled");
  }

  const baseRun = {
    report: report.id,
    trigger_kind: triggerKind,
    started_at: startedAt.toISOString(),
  };

  // 1. Resolve source + template + channels.
  const sourceRow = await pb.collection("sources").getOne(report.source);
  const sourceAdapter = getSourceAdapter(sourceRow.type);
  const template = getTemplate(report.template_id);
  if (template.sourceType !== sourceAdapter.type) {
    return await failRun(
      pb,
      baseRun,
      `template "${template.id}" expects source type "${template.sourceType}" but report uses "${sourceAdapter.type}"`,
    );
  }

  // 2. Fetch source data (only pull sources are supported here; push runs
  //    are produced by the webhook endpoint).
  if (sourceAdapter.mode !== "pull") {
    return await failRun(
      pb,
      baseRun,
      `source "${sourceAdapter.type}" is push-mode; cannot run on cron/manual trigger`,
    );
  }

  let payload: unknown;
  try {
    const decrypted = decryptConfig(
      (sourceRow.config ?? {}) as Record<string, unknown>,
    );
    const config = sourceAdapter.configSchema.parse(decrypted);
    payload = await sourceAdapter.fetch(
      config,
      (report.params ?? {}) as Record<string, unknown>,
      last24hWindow(startedAt),
    );
  } catch (e) {
    return await failRun(
      pb,
      baseRun,
      e instanceof Error ? e.message : String(e),
    );
  }

  // 3. Skip if template says no.
  if (!template.shouldDeliver(payload)) {
    const finishedAt = new Date();
    const created = await pb.collection("runs").create({
      ...baseRun,
      status: "skipped",
      finished_at: finishedAt.toISOString(),
      payload,
      rendered: null,
      deliveries: [],
    });
    return { runId: created.id, status: "skipped" };
  }

  // 4. Render once, deliver to each channel.
  const rendered: RenderedContent = {
    email: template.renderEmail(payload),
    telegram: template.renderTelegram(payload),
  };

  const channelIds = (report.channels ?? []) as string[];
  const deliveries: DeliveryResult[] = [];
  for (const channelId of channelIds) {
    try {
      const channelRow = await pb.collection("channels").getOne(channelId);
      const channelAdapter = getChannelAdapter(channelRow.type);
      const decrypted = decryptConfig(
        (channelRow.config ?? {}) as Record<string, unknown>,
      );
      const config = channelAdapter.configSchema.parse(decrypted);
      await channelAdapter.deliver(config, rendered);
      deliveries.push({ channel_id: channelId, status: "ok" });
    } catch (e) {
      deliveries.push({
        channel_id: channelId,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const okCount = deliveries.filter((d) => d.status === "ok").length;
  const status: RunStatus =
    okCount === deliveries.length
      ? "success"
      : okCount === 0
        ? "failed"
        : "partial";

  const finishedAt = new Date();
  const created = await pb.collection("runs").create({
    ...baseRun,
    status,
    finished_at: finishedAt.toISOString(),
    payload,
    rendered,
    deliveries,
  });
  return { runId: created.id, status };
}

async function failRun(
  pb: PocketBase,
  base: Record<string, unknown>,
  error: string,
): Promise<RunOutcome> {
  const finishedAt = new Date();
  const created = await pb.collection("runs").create({
    ...base,
    status: "failed",
    finished_at: finishedAt.toISOString(),
    deliveries: [],
    error,
  });
  return { runId: created.id, status: "failed" };
}
