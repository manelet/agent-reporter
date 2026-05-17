import type { Notification } from "@agent-reporter/shared";
import { notificationSchema } from "@agent-reporter/shared";
import type PocketBase from "pocketbase";
import { getChannelAdapter } from "./channels/index.js";
import { decryptConfig } from "./crypto.js";
import { getServerPb } from "./pb.js";
import { getSourceAdapter } from "./sources/index.js";
import type { TimeWindow } from "./sources/types.js";
import { getTemplate } from "./templates/index.js";

export type TriggerKind = "cron" | "webhook" | "manual" | "api";
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
  template_id: string | null;
  source: string;
  channels: string[];
  params: Record<string, unknown>;
  enabled: boolean;
}

async function deliverToChannels(
  pb: PocketBase,
  channelIds: string[],
  notification: Notification,
): Promise<DeliveryResult[]> {
  const deliveries: DeliveryResult[] = [];
  for (const channelId of channelIds) {
    try {
      const channelRow = await pb.collection("channels").getOne(channelId);
      const channelAdapter = getChannelAdapter(channelRow.type);
      const decrypted = decryptConfig(
        (channelRow.config ?? {}) as Record<string, unknown>,
      );
      const config = channelAdapter.configSchema.parse(decrypted);
      await channelAdapter.deliver(config, notification);
      deliveries.push({ channel_id: channelId, status: "ok" });
    } catch (e) {
      deliveries.push({
        channel_id: channelId,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return deliveries;
}

function statusFromDeliveries(deliveries: DeliveryResult[]): RunStatus {
  const okCount = deliveries.filter((d) => d.status === "ok").length;
  if (okCount === deliveries.length) return "success";
  if (okCount === 0) return "failed";
  return "partial";
}

// Shared post-payload path used by the cron/manual/webhook flows: convert
// raw source payload to Notification (via template, or passthrough if the
// source emits Notification directly), then deliver and record.
async function deliverAndRecord(
  pb: PocketBase,
  report: ResolvedReport,
  triggerKind: Exclude<TriggerKind, "api">,
  startedAt: Date,
  payload: unknown,
  sourceEmitsNotification: boolean,
): Promise<RunOutcome> {
  const baseRun = {
    report: report.id,
    trigger_kind: triggerKind,
    started_at: startedAt.toISOString(),
  };

  // Resolve template (if any) and decide shouldDeliver + Notification.
  let shouldDeliver = true;
  let notification: Notification;
  try {
    if (sourceEmitsNotification) {
      // Payload is already a Notification (validated by the source adapter).
      notification = notificationSchema.parse(payload);
      // Implicit shouldDeliver: skip when title is empty (defensive only;
      // the schema already requires title).
      shouldDeliver = !!notification.title;
    } else {
      if (!report.template_id) {
        throw new Error(
          "report has no template but its source requires one",
        );
      }
      const template = getTemplate(report.template_id);
      shouldDeliver = template.shouldDeliver(payload);
      notification = shouldDeliver
        ? template.render(payload)
        : ({ title: "" } as Notification);
    }
  } catch (e) {
    return failRun(
      pb,
      report.id,
      triggerKind,
      startedAt,
      payload,
      e instanceof Error ? e.message : String(e),
    );
  }

  if (!shouldDeliver) {
    const created = await pb.collection("runs").create({
      ...baseRun,
      status: "skipped",
      finished_at: new Date().toISOString(),
      payload,
      notification: null,
      deliveries: [],
    });
    return { runId: created.id, status: "skipped" };
  }

  const deliveries = await deliverToChannels(pb, report.channels, notification);
  const status = statusFromDeliveries(deliveries);

  const created = await pb.collection("runs").create({
    ...baseRun,
    status,
    finished_at: new Date().toISOString(),
    payload,
    notification,
    deliveries,
  });
  return { runId: created.id, status };
}

async function failRun(
  pb: PocketBase,
  reportId: string | null,
  triggerKind: TriggerKind,
  startedAt: Date,
  payload: unknown,
  error: string,
): Promise<RunOutcome> {
  const created = await pb.collection("runs").create({
    report: reportId,
    trigger_kind: triggerKind,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    status: "failed",
    payload,
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
  if (sourceAdapter.mode !== "pull") {
    return failRun(
      pb,
      report.id,
      triggerKind,
      startedAt,
      null,
      `source "${sourceAdapter.type}" is push-mode; cannot run on cron/manual trigger`,
    );
  }

  // Cross-validate template <-> source.
  if (sourceAdapter.emitsNotification) {
    if (report.template_id) {
      return failRun(
        pb,
        report.id,
        triggerKind,
        startedAt,
        null,
        `source "${sourceAdapter.type}" emits Notification directly; report must not have a template`,
      );
    }
  } else {
    if (!report.template_id) {
      return failRun(
        pb,
        report.id,
        triggerKind,
        startedAt,
        null,
        `source "${sourceAdapter.type}" requires a template`,
      );
    }
    const template = getTemplate(report.template_id);
    if (template.sourceType !== sourceAdapter.type) {
      return failRun(
        pb,
        report.id,
        triggerKind,
        startedAt,
        null,
        `template "${template.id}" expects source type "${template.sourceType}" but report uses "${sourceAdapter.type}"`,
      );
    }
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
      null,
      e instanceof Error ? e.message : String(e),
    );
  }

  return deliverAndRecord(
    pb,
    report,
    triggerKind,
    startedAt,
    payload,
    sourceAdapter.emitsNotification,
  );
}

// Push flow: the webhook endpoint already verified the HMAC signature and
// parsed the payload through the source adapter. We just need to deliver.
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

  // We need the source to know whether the payload is already a Notification.
  const sourceRow = await pb.collection("sources").getOne(report.source);
  const sourceAdapter = getSourceAdapter(sourceRow.type);

  return deliverAndRecord(
    pb,
    report,
    "webhook",
    startedAt,
    payload,
    sourceAdapter.emitsNotification,
  );
}

// API flow: bearer-authenticated direct entrypoint. No report, no source —
// the caller hands us a Notification and a list of channel ids.
export async function executeApiNotification(
  channelIds: string[],
  notification: Notification,
  pbOverride?: PocketBase,
): Promise<RunOutcome> {
  const pb = pbOverride ?? (await getServerPb());
  const startedAt = new Date();

  const deliveries = await deliverToChannels(pb, channelIds, notification);
  const status = statusFromDeliveries(deliveries);

  const created = await pb.collection("runs").create({
    report: null,
    trigger_kind: "api",
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    status,
    payload: null,
    notification,
    deliveries,
  });
  return { runId: created.id, status };
}
