import type { Notification } from "@agent-reporter/shared";
import type { GithubActionsWorkflowRunData } from "../sources/github-actions.js";
import type { ReportTemplate } from "./types.js";

export const ghActionsWorkflowFailure: ReportTemplate<
  GithubActionsWorkflowRunData
> = {
  id: "gh-actions-workflow-failure",
  description:
    "Notifies when a completed workflow_run has a non-success conclusion (failure, cancelled, timed_out).",
  sourceType: "github-actions",

  shouldDeliver(data) {
    const c = data.workflow_run.conclusion;
    if (!c) return false;
    return c !== "success" && c !== "skipped" && c !== "neutral";
  },

  mockData() {
    return {
      action: "completed",
      workflow_run: {
        id: 9876543210,
        name: "CI",
        status: "completed",
        conclusion: "failure",
        html_url: "https://github.com/example/repo/actions/runs/9876543210",
        head_branch: "main",
        head_sha: "abc123def456abc123def456abc123def4567890",
        run_number: 42,
        run_attempt: 1,
        event: "push",
        actor: { login: "octocat" },
        triggering_actor: { login: "octocat" },
        created_at: "2026-05-07T08:00:00Z",
        updated_at: "2026-05-07T08:05:00Z",
      },
      repository: {
        full_name: "example/repo",
        html_url: "https://github.com/example/repo",
      },
      sender: { login: "octocat" },
    };
  },

  render(data): Notification {
    const r = data.workflow_run;
    const sha = r.head_sha.slice(0, 7);
    const branch = r.head_branch ?? "(detached)";
    const actor = r.triggering_actor?.login ?? r.actor?.login ?? "—";
    return {
      title: `${data.repository.full_name} · ${r.name} ${r.conclusion} (#${r.run_number})`,
      level: "error",
      metadata: [
        { key: "Repository", value: data.repository.full_name },
        { key: "Workflow", value: r.name },
        { key: "Conclusion", value: r.conclusion ?? "(none)" },
        { key: "Branch", value: branch },
        { key: "Commit", value: sha },
        { key: "Triggered by", value: `${actor} (${r.event})` },
        { key: "Attempt", value: `${r.run_attempt} of run #${r.run_number}` },
      ],
      links: [
        { label: "View workflow run", url: r.html_url },
        { label: "View repository", url: data.repository.html_url },
      ],
    };
  },
};
