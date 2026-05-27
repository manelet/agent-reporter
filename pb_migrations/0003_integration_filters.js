/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const integrations = app.findCollectionByNameOrId("integrations");
    integrations.fields.add(
      new Field({
        name: "filters",
        type: "json",
        required: false,
        maxSize: 50000,
      }),
    );
    app.save(integrations);
  },
  (app) => {
    const integrations = app.findCollectionByNameOrId("integrations");
    integrations.fields.removeByName("filters");
    app.save(integrations);
  },
);
