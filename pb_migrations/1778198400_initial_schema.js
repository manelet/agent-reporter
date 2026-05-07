/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // sources
    const sources = new Collection({
      type: "base",
      name: "sources",
      fields: [
        { name: "name", type: "text", required: true, max: 200 },
        {
          name: "type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["sentry", "mixpanel", "github-actions", "custom-api"],
        },
        { name: "config", type: "json", required: true, maxSize: 200000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_sources_type` ON `sources` (`type`)",
      ],
    });
    app.save(sources);

    // channels
    const channels = new Collection({
      type: "base",
      name: "channels",
      fields: [
        { name: "name", type: "text", required: true, max: 200 },
        {
          name: "type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["email", "telegram"],
        },
        { name: "config", type: "json", required: true, maxSize: 200000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_channels_type` ON `channels` (`type`)",
      ],
    });
    app.save(channels);

    // reports
    const reports = new Collection({
      type: "base",
      name: "reports",
      fields: [
        { name: "name", type: "text", required: true, max: 200 },
        {
          name: "source",
          type: "relation",
          required: true,
          collectionId: sources.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "channels",
          type: "relation",
          required: true,
          collectionId: channels.id,
          minSelect: 1,
          maxSelect: 99,
          cascadeDelete: false,
        },
        { name: "template_id", type: "text", required: true, max: 100 },
        { name: "params", type: "json", maxSize: 200000 },
        {
          name: "trigger",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["cron", "webhook"],
        },
        { name: "cron", type: "text", max: 100 },
        { name: "webhook_secret", type: "text", max: 500 },
        { name: "enabled", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_reports_enabled` ON `reports` (`enabled`)",
        "CREATE INDEX `idx_reports_trigger` ON `reports` (`trigger`)",
      ],
    });
    app.save(reports);

    // runs
    const runs = new Collection({
      type: "base",
      name: "runs",
      fields: [
        {
          name: "report",
          type: "relation",
          required: true,
          collectionId: reports.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["success", "partial", "skipped", "failed"],
        },
        {
          name: "trigger_kind",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["cron", "webhook", "manual"],
        },
        { name: "started_at", type: "date" },
        { name: "finished_at", type: "date" },
        { name: "payload", type: "json", maxSize: 5000000 },
        { name: "rendered", type: "json", maxSize: 5000000 },
        { name: "deliveries", type: "json", maxSize: 1000000 },
        { name: "error", type: "text", max: 5000 },
        { name: "created", type: "autodate", onCreate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_runs_report_started` ON `runs` (`report`, `started_at` DESC)",
        "CREATE INDEX `idx_runs_status` ON `runs` (`status`)",
      ],
    });
    app.save(runs);
  },
  (app) => {
    for (const name of ["runs", "reports", "channels", "sources"]) {
      const c = app.findCollectionByNameOrId(name);
      app.delete(c);
    }
  },
);
