import type { NotificationTemplate } from "@reporter/shared";
import type { Provider } from "./index.js";

export const defaultTemplates: Record<string, NotificationTemplate> = {
  alert: {
    title: "Mixpanel Alert: {{alert_name}}",
    body: "{{alert_message}}",
    level: "warn",
    metadata: [
      { key: "Project", value: "{{project_name}}" },
      { key: "Alert ID", value: "{{alert_id}}" },
    ],
    links: [{ label: "View in Mixpanel", url: "{{alert_url}}" }],
  },

  "custom-alert": {
    title: "{{alert_name}}",
    body: "Value: {{current_value}} (threshold: {{threshold_value}})",
    level: "warn",
    metadata: [
      { key: "Metric", value: "{{metric_name}}" },
      { key: "Direction", value: "{{direction}}" },
      { key: "Project", value: "{{project_name}}" },
    ],
    links: [{ label: "View in Mixpanel", url: "{{alert_url}}" }],
  },
};

export const mixpanelProvider: Provider = {
  type: "mixpanel",

  getEventType(_headers, body) {
    if (typeof body === "object" && body !== null) {
      const b = body as Record<string, unknown>;
      if (typeof b.type === "string") return b.type;
      if (b.alert_id) return "alert";
    }
    return "alert";
  },

  verify() {
    return true;
  },

  defaultTemplates,
};
