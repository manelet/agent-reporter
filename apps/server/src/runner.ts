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

interface ResolvedReport {
  id: string;
  template_id: string;
  source: string;
  channels: string[];
  params: Record<string, unknown>;
  enabled: boolean;
}

// Shared post-fetch path: shouldDeliver → render → deliver → save run.
async function deliverAndRecord(
  pb: PocketBase,
  report: ResolvedReport,
  triggerKind: TriggerKind,
  startedAt: Date,
  payload: unknown,
): Promise<RunOutcome> {
  const baseRun = {
    report: report.id,
    trigger_kind: triggerKind,
    started_at: startedAt.toISOString(),
  };
  const template = getTemplate(report.template_id);

  if (!template.shouldDeliver(payload)) {
    const created = await pb.collection("runs").create({
      ...baseRun,
      status: "skipped",
      finished_at: new Date().toISOString(),
      payload,
      rendered: null,
      deliveries: [],
    });
    return { runId: created.id, status: "skipped" };
  }

  const rendered: RenderedContent = {
    email: template.renderEmail(payload),
    telegram: template.renderTelegram(payload),
  };

  const deliveries: DeliveryResult[] = [];
  for (const channelId of report.channels) {
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

  const created = await pb.collection("runs").create({
    ...baseRun,
    status,
    finished_at: new Date().toISOString(),
    payload,
    rendered,
    deliveries,
  });
  return { runId: created.id, status };
}

async function failRun(
  pb: PocketBase,
  reportId: string,
  triggerKind: TriggerKind,
  startedAt: Date,
  error: string,
): Promise<RunOutcome> {
  const created = await pb.collection("runs").create({
    report: reportId,
    trigger_kind: triggerKind,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    status: "failed",
    deliveries: [],
    error,
  });
  return { runId: created.id, status: "failed" };
}

// Pull flow: cron or manual. Fetches from the source then delivers.
export async function executeReport(
  reportId: string,
  triggerKind: "cron" | "manual",
  pbOverride?: PocketBase,
): Promise<RunOutcome> {
  const pb = pbOverride ?? (await getServerPb());
  const startedAt = new Date();

  const report = (await pb
    .collection("reports")
    .getOne(reportId)) as unknown as ResolvedReport & { trigger: string };
  if (!report.enabled && triggerKind !== "manual") {
    throw new Error("report is disabled");
  }

  const sourceRow = await pb.collection("sources").getOne(report.source);
  const sourceAdapter = getSourceAdapter(sourceRow.type);
  const template = getTemplate(report.template_id);
  if (template.sourceType !== sourceAdapter.type) {
    return failRun(
      pb,
      report.id,
      triggerKind,
      startedAt,
      `template "${template.id}" expects source type "${template.sourceType}" but report uses "${sourceAdapter.type}"`,
    );
  }
  if (sourceAdapter.mode !== "pull") {
    return failRun(
      pb,
      report.id,
      triggerKind,
      startedAt,
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
    return failRun(
      pb,
      report.id,
      triggerKind,
      startedAt,
      e instanceof Error ? e.message : String(e),
    );
  }

  return deliverAndRecord(pb, report, triggerKind, startedAt, payload);
}

// Push flow: webhook endpoint already verified the signature and parsed
// the payload through the source adapter. We just need to deliver.
export async function executeWebhookReport(
  reportId: string,
  payload: unknown,
  pbOverride?: PocketBase,
): Promise<RunOutcome> {
  const pb = pbOverride ?? (await getServerPb());
  const startedAt = new Date();

  const report = (await pb
    .collection("reports")
    .getOne(reportId)) as unknown as ResolvedReport;

  return deliverAndRecord(pb, report, "webhook", startedAt, payload);
}
