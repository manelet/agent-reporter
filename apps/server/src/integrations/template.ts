import type { Notification, NotificationSection } from "@reporter/shared";
import type { NotificationTemplate } from "@reporter/shared";

function resolve(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function interpolateString(template: string, data: unknown): string {
  return template.replace(/\{\{([^#/}]+?)\}\}/g, (_match, path: string) => {
    const val = resolve(data, path.trim());
    if (val == null) return "";
    return String(val);
  });
}

function processItems(
  section: NonNullable<NotificationTemplate["sections"]>[number],
  data: unknown,
): NotificationSection | null {
  const arrayPath = section.items;
  const arr = resolve(data, arrayPath.trim());
  if (!Array.isArray(arr) || arr.length === 0) return null;

  return {
    heading: interpolateString(section.heading, data),
    items: arr.map((item) => ({
      label: interpolateString(section.label, item),
      value: interpolateString(section.value, item),
      ...(section.url ? { url: interpolateString(section.url, item) } : {}),
    })),
  };
}

export function applyTemplate(
  template: NotificationTemplate,
  payload: unknown,
): Notification {
  const notification: Notification = {
    title: interpolateString(template.title, payload),
  };

  if (template.body) {
    notification.body = interpolateString(template.body, payload);
  }

  if (template.level) {
    const level = interpolateString(template.level, payload);
    if (["info", "warn", "error", "success"].includes(level)) {
      notification.level = level as Notification["level"];
    }
  }

  if (template.sections) {
    const sections = template.sections
      .map((s) => processItems(s, payload))
      .filter((s): s is NotificationSection => s !== null);
    if (sections.length > 0) notification.sections = sections;
  }

  if (template.metadata) {
    notification.metadata = template.metadata.map((m) => ({
      key: interpolateString(m.key, payload),
      value: interpolateString(m.value, payload),
    }));
  }

  if (template.links) {
    notification.links = template.links.map((l) => ({
      label: interpolateString(l.label, payload),
      url: interpolateString(l.url, payload),
    }));
  }

  return notification;
}
