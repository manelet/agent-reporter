import { ghActionsWorkflowFailure } from "./gh-actions-workflow-failure.js";
import { sentryDaily } from "./sentry-daily.js";
import type { ReportTemplate } from "./types.js";

export const templates: Record<string, ReportTemplate> = {
  [ghActionsWorkflowFailure.id]: ghActionsWorkflowFailure as ReportTemplate,
  [sentryDaily.id]: sentryDaily as ReportTemplate,
};

export function getTemplate(id: string): ReportTemplate {
  const tpl = templates[id];
  if (!tpl) throw new Error(`unknown template: ${id}`);
  return tpl;
}

export function listTemplates(): Array<{
  id: string;
  description: string;
  sourceType: string;
}> {
  return Object.values(templates).map((t) => ({
    id: t.id,
    description: t.description,
    sourceType: t.sourceType,
  }));
}

export type * from "./types.js";
