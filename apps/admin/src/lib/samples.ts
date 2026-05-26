import type { NotificationTemplate } from "@reporter/shared";

export const providerEventTypes: Record<string, string[]> = {
  github: ["push", "pull_request", "issues", "workflow_run"],
  mixpanel: ["alert", "custom-alert"],
};

export const samplePayloads: Record<string, Record<string, unknown>> = {
  "github:push": {
    ref: "refs/heads/main",
    commits: [
      {
        message: "fix: resolve login redirect loop",
        author: { name: "John Doe" },
        url: "https://github.com/acme/app/commit/abc123",
      },
      {
        message: "feat: add dark mode toggle",
        author: { name: "Jane Smith" },
        url: "https://github.com/acme/app/commit/def456",
      },
    ],
    pusher: { name: "johndoe" },
    repository: { name: "app", full_name: "acme/app" },
    compare: "https://github.com/acme/app/compare/abc...def",
    sender: { login: "johndoe" },
  },
  "github:pull_request": {
    action: "opened",
    pull_request: {
      title: "Add user authentication",
      number: 42,
      user: { login: "johndoe" },
      state: "open",
      additions: 150,
      deletions: 30,
      changed_files: 8,
      html_url: "https://github.com/acme/app/pull/42",
    },
  },
  "github:issues": {
    action: "opened",
    issue: {
      title: "Login page broken on mobile",
      number: 15,
      user: { login: "janedoe" },
      state: "open",
      labels: [{ name: "bug" }],
      html_url: "https://github.com/acme/app/issues/15",
    },
  },
  "github:workflow_run": {
    action: "completed",
    workflow_run: {
      name: "CI",
      conclusion: "success",
      head_branch: "main",
      event: "push",
      status: "completed",
      html_url: "https://github.com/acme/app/actions/runs/123",
    },
  },
  "mixpanel:alert": {
    alert_name: "Daily Active Users Drop",
    alert_message: "DAU dropped below 1,000 threshold",
    project_name: "My App",
    alert_id: "12345",
    alert_url: "https://mixpanel.com/project/123/view/alerts",
  },
  "mixpanel:custom-alert": {
    type: "custom-alert",
    alert_name: "Conversion Rate Alert",
    current_value: "2.3%",
    threshold_value: "3%",
    metric_name: "Signup Conversion",
    direction: "below",
    project_name: "My App",
    alert_url: "https://mixpanel.com/project/123/view/alerts",
  },
};

export const defaultTemplates: Record<string, Record<string, NotificationTemplate>> = {
  github: {
    push: {
      title: "Push to {{repository.name}}",
      body: "{{pusher.name}} pushed to {{ref}}",
      level: "info",
      sections: [
        {
          heading: "Commits",
          items: "commits",
          label: "{{message}}",
          value: "{{author.name}}",
          url: "{{url}}",
        },
      ],
      metadata: [
        { key: "Branch", value: "{{ref}}" },
        { key: "Pusher", value: "{{pusher.name}}" },
      ],
      links: [{ label: "Compare", url: "{{compare}}" }],
    },
    pull_request: {
      title: "PR {{action}}: {{pull_request.title}}",
      body: "#{{pull_request.number}} by {{pull_request.user.login}}",
      level: "info",
      metadata: [
        { key: "State", value: "{{pull_request.state}}" },
        { key: "Additions", value: "{{pull_request.additions}}" },
        { key: "Deletions", value: "{{pull_request.deletions}}" },
        { key: "Changed files", value: "{{pull_request.changed_files}}" },
      ],
      links: [{ label: "View PR", url: "{{pull_request.html_url}}" }],
    },
    issues: {
      title: "Issue {{action}}: {{issue.title}}",
      body: "#{{issue.number}} by {{issue.user.login}}",
      level: "info",
      metadata: [
        { key: "State", value: "{{issue.state}}" },
        { key: "Labels", value: "{{issue.labels.length}}" },
      ],
      links: [{ label: "View issue", url: "{{issue.html_url}}" }],
    },
    workflow_run: {
      title: "Workflow {{action}}: {{workflow_run.name}}",
      body: "Conclusion: {{workflow_run.conclusion}}",
      level: "info",
      metadata: [
        { key: "Branch", value: "{{workflow_run.head_branch}}" },
        { key: "Event", value: "{{workflow_run.event}}" },
        { key: "Status", value: "{{workflow_run.status}}" },
      ],
      links: [{ label: "View run", url: "{{workflow_run.html_url}}" }],
    },
  },
  mixpanel: {
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
  },
};
