import type { GithubActionsWorkflowRunData } from "../sources/github-actions.js";
import type { ReportTemplate } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

  renderEmail(data) {
    const r = data.workflow_run;
    const subject = `[${data.repository.full_name}] ${r.name} ${r.conclusion} (#${r.run_number})`;
    const sha = r.head_sha.slice(0, 7);
    const branch = r.head_branch ?? "(detached)";
    const actor = r.triggering_actor?.login ?? r.actor?.login ?? "—";
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:1rem;color:#222">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${escapeHtml(r.name)} <span style="color:#b00">${escapeHtml(r.conclusion ?? "?")}</span></h1>
<p style="color:#444">Repository: <a href="${escapeHtml(data.repository.html_url)}">${escapeHtml(data.repository.full_name)}</a></p>
<ul>
  <li>Branch: <code>${escapeHtml(branch)}</code></li>
  <li>Commit: <code>${escapeHtml(sha)}</code></li>
  <li>Triggered by: ${escapeHtml(actor)} (${escapeHtml(r.event)})</li>
  <li>Attempt: ${r.run_attempt} of run #${r.run_number}</li>
</ul>
<p><a href="${escapeHtml(r.html_url)}">View workflow run →</a></p>
</body></html>`;
    return { subject, html };
  },

  renderTelegram(data) {
    const r = data.workflow_run;
    const sha = r.head_sha.slice(0, 7);
    const branch = r.head_branch ?? "(detached)";
    const actor = r.triggering_actor?.login ?? r.actor?.login ?? "—";
    return [
      `❌ ${data.repository.full_name} · ${r.name} ${r.conclusion}`,
      `branch: ${branch} @ ${sha}`,
      `triggered by ${actor} (${r.event}), attempt ${r.run_attempt}`,
      r.html_url,
    ].join("\n");
  },
};
