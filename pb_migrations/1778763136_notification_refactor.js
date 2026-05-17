/// <reference path="../pb_data/types.d.ts" />
// M4 — Notification refactor. See docs/PRD.md §8 M4.
//
// Schema changes:
//   sources.type            +"notification-webhook"
//   reports.template_id     required → nullable
//   runs.report             required → nullable (api runs have no report)
//   runs.rendered           dropped; replaced by runs.notification (json)
//   runs.trigger_kind       +"api"
//   api_keys (new)          name, token_hash, last_used_at, revoked_at
migrate(
  (app) => {
    // sources.type — add "notification-webhook".
    const sources = app.findCollectionByNameOrId("sources");
    const sourcesType = sources.fields.find((f) => f.name === "type");
    sourcesType.values = [
      "sentry",
      "mixpanel",
      "github-actions",
      "custom-api",
      "notification-webhook",
    ];
    app.save(sources);

    // reports.template_id — drop the `required` flag so it can be empty for
    // sources that emit Notification directly.
    const reports = app.findCollectionByNameOrId("reports");
    const templateId = reports.fields.find((f) => f.name === "template_id");
    templateId.required = false;
    app.save(reports);

    // runs — report becomes nullable, replace `rendered` with `notification`,
    // and extend the trigger_kind enum.
    const runs = app.findCollectionByNameOrId("runs");

    const reportField = runs.fields.find((f) => f.name === "report");
    reportField.required = false;
    // Direct entrypoint (api) runs have no parent — keep cascade behaviour
    // sane: when a report is deleted, its runs go too, but standalone api
    // runs are unaffected.
    reportField.cascadeDelete = true;

    const renderedField = runs.fields.find((f) => f.name === "rendered");
    if (renderedField) {
      renderedField.name = "notification";
    }

    const triggerKind = runs.fields.find((f) => f.name === "trigger_kind");
    triggerKind.values = ["cron", "webhook", "manual", "api"];

    app.save(runs);

    // api_keys — single global key for now, hash-only persistence.
    const apiKeys = new Collection({
      type: "base",
      name: "api_keys",
      fields: [
        { name: "name", type: "text", required: true, max: 100 },
        { name: "token_hash", type: "text", required: true, max: 128 },
        { name: "last_used_at", type: "date" },
        { name: "revoked_at", type: "date" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_api_keys_token_hash` ON `api_keys` (`token_hash`)",
      ],
    });
    app.save(apiKeys);
  },
  (app) => {
    // Down: best-effort reverse. Some changes (Notification payloads in
    // runs.notification) cannot be migrated back to the old per-channel
    // shape — they'll just be lost.
    const apiKeys = app.findCollectionByNameOrId("api_keys");
    app.delete(apiKeys);

    const runs = app.findCollectionByNameOrId("runs");
    const reportField = runs.fields.find((f) => f.name === "report");
    reportField.required = true;
    const notificationField = runs.fields.find((f) => f.name === "notification");
    if (notificationField) {
      notificationField.name = "rendered";
    }
    const triggerKind = runs.fields.find((f) => f.name === "trigger_kind");
    triggerKind.values = ["cron", "webhook", "manual"];
    app.save(runs);

    const reports = app.findCollectionByNameOrId("reports");
    const templateId = reports.fields.find((f) => f.name === "template_id");
    templateId.required = true;
    app.save(reports);

    const sources = app.findCollectionByNameOrId("sources");
    const sourcesType = sources.fields.find((f) => f.name === "type");
    sourcesType.values = [
      "sentry",
      "mixpanel",
      "github-actions",
      "custom-api",
    ];
    app.save(sources);
  },
);
