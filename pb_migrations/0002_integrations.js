/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const integrations = new Collection({
      type: "base",
      name: "integrations",
      fields: [
        { name: "name", type: "text", required: true, max: 100 },
        {
          name: "provider",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["github", "mixpanel"],
        },
        {
          name: "channels",
          type: "select",
          required: true,
          maxSelect: 2,
          values: ["telegram", "email"],
        },
        { name: "to", type: "text", max: 500 },
        { name: "templates", type: "json", required: true, maxSize: 500000 },
        { name: "secret", type: "text", max: 500 },
        { name: "enabled", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_integrations_provider` ON `integrations` (`provider`)",
      ],
    });
    app.save(integrations);

    // Make token_id optional on notification_logs and add integration_id
    const logs = app.findCollectionByNameOrId("notification_logs");
    const integrationsCol = app.findCollectionByNameOrId("integrations");

    const tokenField = logs.fields.getByName("token_id");
    tokenField.required = false;

    logs.fields.add(
      new Field({
        name: "integration_id",
        type: "relation",
        required: false,
        collectionId: integrationsCol.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    logs.indexes.push(
      "CREATE INDEX `idx_notification_logs_integration_id` ON `notification_logs` (`integration_id`)",
    );
    app.save(logs);
  },
  (app) => {
    // Remove integration_id from notification_logs
    try {
      const logs = app.findCollectionByNameOrId("notification_logs");
      const field = logs.fields.getByName("integration_id");
      if (field) {
        logs.fields.removeByName("integration_id");
        app.save(logs);
      }
    } catch {
      // skip
    }

    try {
      const integrations = app.findCollectionByNameOrId("integrations");
      app.delete(integrations);
    } catch {
      // Already gone.
    }
  },
);
