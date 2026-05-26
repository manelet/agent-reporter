/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Drop old collections (order matters for foreign keys).
    for (const name of ["runs", "reports", "channels", "sources", "api_tokens"]) {
      try {
        const col = app.findCollectionByNameOrId(name);
        app.delete(col);
      } catch {
        // Collection doesn't exist — skip.
      }
    }

    // api_keys — keep if it already exists, create otherwise.
    try {
      app.findCollectionByNameOrId("api_keys");
    } catch {
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
    }

    // notification_logs — delivery log for every /api/notify call.
    try {
      app.findCollectionByNameOrId("notification_logs");
      return; // Already exists — skip.
    } catch {
      // Doesn't exist — create it.
    }
    const apiKeys = app.findCollectionByNameOrId("api_keys");
    const logs = new Collection({
      type: "base",
      name: "notification_logs",
      fields: [
        {
          name: "token_id",
          type: "relation",
          required: true,
          collectionId: apiKeys.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: "channel",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["telegram", "email"],
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["success", "failed"],
        },
        { name: "notification", type: "json", required: true, maxSize: 500000 },
        { name: "recipient", type: "text", max: 500 },
        { name: "error", type: "text", max: 5000 },
        { name: "created", type: "autodate", onCreate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_notification_logs_token_id` ON `notification_logs` (`token_id`)",
        "CREATE INDEX `idx_notification_logs_status` ON `notification_logs` (`status`)",
        "CREATE INDEX `idx_notification_logs_created` ON `notification_logs` (`created` DESC)",
      ],
    });
    app.save(logs);
  },
  (app) => {
    try {
      const logs = app.findCollectionByNameOrId("notification_logs");
      app.delete(logs);
    } catch {
      // Already gone.
    }
  },
);
