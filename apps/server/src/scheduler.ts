import cron, { type ScheduledTask } from "node-cron";
import { env } from "./env.js";
import { getServerPb } from "./pb.js";
import { executeReport } from "./runner.js";

const tasks = new Map<string, ScheduledTask>();

interface ReportRow {
  id: string;
  cron: string;
  enabled: boolean;
  trigger: string;
}

async function loadCronReports(): Promise<ReportRow[]> {
  const pb = await getServerPb();
  const list = await pb.collection("reports").getFullList<ReportRow>({
    filter: "trigger = 'cron' && enabled = true",
  });
  return list.filter((r) => r.cron && r.cron.trim().length > 0);
}

function clearAll(): void {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
}

export async function reloadSchedules(): Promise<void> {
  clearAll();
  const reports = await loadCronReports();
  for (const r of reports) {
    if (!cron.validate(r.cron)) {
      console.warn(`[scheduler] invalid cron for report ${r.id}: ${r.cron}`);
      continue;
    }
    const task = cron.schedule(
      r.cron,
      () => {
        executeReport(r.id, "cron").catch((e: unknown) => {
          console.error(`[scheduler] report ${r.id} failed:`, e);
        });
      },
      { timezone: env.CRON_TIMEZONE },
    );
    tasks.set(r.id, task);
  }
  console.log(
    `[scheduler] loaded ${tasks.size} cron report(s) (TZ ${env.CRON_TIMEZONE})`,
  );
}

export async function initScheduler(): Promise<void> {
  await reloadSchedules();
}
