import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { IntegrationRecord, NotificationTemplate, ChannelType } from "@reporter/shared";
import { Button, Field, TextInput, Select, TextArea } from "../components/Field.js";
import { EmptyList } from "../components/EmptyList.js";
import { PageHeader } from "../components/PageHeader.js";
import { TelegramPreview, EmailPreview } from "../components/NotificationPreview.js";
import { api } from "../lib/api.js";
import { applyTemplate } from "../lib/template.js";
import {
  providerEventTypes,
  samplePayloads,
  defaultTemplates,
} from "../lib/samples.js";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  mixpanel: "Mixpanel",
};

type FormMode = "list" | "create" | "edit";

function TemplateEditor({
  template,
  onChange,
}: {
  template: NotificationTemplate;
  onChange: (t: NotificationTemplate) => void;
}) {
  const advancedJson = useMemo(() => {
    const { title: _t, body: _b, level: _l, ...rest } = template;
    return JSON.stringify(rest, null, 2);
  }, [template]);

  function updateAdvanced(json: string) {
    try {
      const parsed = JSON.parse(json);
      onChange({ title: template.title, ...(template.body != null ? { body: template.body } : {}), ...(template.level != null ? { level: template.level } : {}), ...parsed });
    } catch {
      // ignore invalid json while typing
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Title" hint="Use {{path.to.field}} for placeholders">
        <TextInput
          value={template.title}
          onChange={(e) => onChange({ ...template, title: e.target.value })}
        />
      </Field>
      <Field label="Body">
        <TextArea
          value={template.body ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            const next = { ...template };
            if (val) next.body = val; else delete next.body;
            onChange(next);
          }}
          rows={2}
        />
      </Field>
      <Field label="Level">
        <Select
          value={template.level ?? "info"}
          onChange={(e) => onChange({ ...template, level: e.target.value })}
        >
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
          <option value="success">Success</option>
        </Select>
      </Field>
      <Field label="Sections, metadata & links (JSON)" hint="Advanced: edit sections, metadata, and links">
        <TextArea
          value={advancedJson}
          onChange={(e) => updateAdvanced(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
      </Field>
    </div>
  );
}

function PreviewPanel({
  template,
  provider,
  eventType,
  channels,
}: {
  template: NotificationTemplate;
  provider: string;
  eventType: string;
  channels: ChannelType[];
}) {
  const sample = samplePayloads[`${provider}:${eventType}`];
  const notification = useMemo(() => {
    if (!sample) return null;
    try {
      return applyTemplate(template, sample);
    } catch {
      return null;
    }
  }, [template, sample]);

  if (!notification) {
    return (
      <p className="text-xs text-zinc-500">
        No preview available for this event type.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {channels.includes("telegram") ? (
        <TelegramPreview notification={notification} />
      ) : null}
      {channels.includes("email") ? (
        <EmailPreview notification={notification} />
      ) : null}
    </div>
  );
}

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<FormMode>("list");
  const [editingIntegration, setEditingIntegration] = useState<IntegrationRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("github");
  const [channels, setChannels] = useState<ChannelType[]>(["telegram"]);
  const [eventType, setEventType] = useState("push");
  const [to, setTo] = useState("");
  const [secret, setSecret] = useState("");
  const [template, setTemplate] = useState<NotificationTemplate>(
    defaultTemplates.github!.push!,
  );

  // Edit-mode state
  const [editEventType, setEditEventType] = useState("");
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(null);

  const list = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get<IntegrationRecord[]>("/api/integrations"),
  });

  const create = useMutation({
    mutationFn: () => {
      const allTemplates = { ...defaultTemplates[provider] };
      allTemplates[eventType] = template;
      return api.post<IntegrationRecord>("/api/integrations", {
        name,
        provider,
        channels,
        ...(to ? { to } : {}),
        ...(secret ? { secret } : {}),
      });
    },
    onSuccess: async (record) => {
      const allTemplates = { ...defaultTemplates[provider] };
      allTemplates[eventType] = template;
      await api.patch(`/api/integrations/${record.id}`, { templates: allTemplates });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      resetForm();
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "create failed"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/api/integrations/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/integrations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const updateTemplates = useMutation({
    mutationFn: ({ id, templates }: { id: string; templates: Record<string, NotificationTemplate> }) =>
      api.patch(`/api/integrations/${id}`, { templates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      setMode("list");
      setEditingIntegration(null);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "update failed"),
  });

  function resetForm() {
    setMode("list");
    setName("");
    setProvider("github");
    setChannels(["telegram"]);
    setEventType("push");
    setTo("");
    setSecret("");
    setTemplate(defaultTemplates.github!.push!);
    setErr(null);
    setEditingIntegration(null);
    setEditTemplate(null);
  }

  function onProviderChange(p: string) {
    setProvider(p);
    const events = providerEventTypes[p] ?? [];
    const firstEvent = events[0] ?? "";
    setEventType(firstEvent);
    const t = defaultTemplates[p]?.[firstEvent];
    setTemplate(t ?? { title: "" });
  }

  function onEventTypeChange(et: string) {
    setEventType(et);
    const t = defaultTemplates[provider]?.[et];
    setTemplate(t ?? { title: "" });
  }

  function toggleChannel(ch: ChannelType) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  function startEdit(intg: IntegrationRecord) {
    setEditingIntegration(intg);
    const events = providerEventTypes[intg.provider] ?? [];
    const first = events[0] ?? "";
    setEditEventType(first);
    setEditTemplate(intg.templates[first] ?? defaultTemplates[intg.provider]?.[first] ?? null);
    setErr(null);
    setMode("edit");
  }

  function onEditEventChange(et: string) {
    if (!editingIntegration) return;
    setEditEventType(et);
    setEditTemplate(
      editingIntegration.templates[et] ??
        defaultTemplates[editingIntegration.provider]?.[et] ??
        null,
    );
  }

  function saveEdit() {
    if (!editingIntegration || !editTemplate) return;
    const templates = { ...editingIntegration.templates, [editEventType]: editTemplate };
    updateTemplates.mutate({ id: editingIntegration.id, templates });
  }

  const webhookBase = window.location.origin.replace("admin.", "api.");

  // ── Create form ──────────────────────────────────────────────
  if (mode === "create") {
    const events = providerEventTypes[provider] ?? [];

    return (
      <div className="max-w-4xl">
        <PageHeader title="New integration" actions={<Button onClick={resetForm}>Cancel</Button>} />
        {err ? <p className="mb-4 text-sm text-red-400">{err}</p> : null}

        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My GitHub repo" />
            </Field>

            <Field label="Provider">
              <Select value={provider} onChange={(e) => onProviderChange(e.target.value)}>
                <option value="github">GitHub</option>
                <option value="mixpanel">Mixpanel</option>
              </Select>
            </Field>

            <Field label="Channels">
              <div className="flex gap-4 pt-1">
                {(["telegram", "email"] as ChannelType[]).map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                      className="accent-emerald-500"
                    />
                    {ch === "telegram" ? "Telegram" : "Email"}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Event type">
              <Select value={eventType} onChange={(e) => onEventTypeChange(e.target.value)}>
                {events.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </Select>
            </Field>

            <Field label="Recipient (optional)" hint="Override default. Chat ID for Telegram, email for Email.">
              <TextInput value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>

            <Field label="Webhook secret (optional)" hint="GitHub: verifies X-Hub-Signature-256">
              <TextInput value={secret} onChange={(e) => setSecret(e.target.value)} />
            </Field>

            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-3 text-xs font-medium text-zinc-400">
                Template for "{eventType}"
              </p>
              <TemplateEditor template={template} onChange={setTemplate} />
            </div>

            <Button
              variant="primary"
              onClick={() => create.mutate()}
              disabled={!name || channels.length === 0 || create.isPending}
            >
              {create.isPending ? "Creating..." : "Create integration"}
            </Button>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium text-zinc-400">Preview</p>
            <PreviewPanel
              template={template}
              provider={provider}
              eventType={eventType}
              channels={channels}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Edit templates ───────────────────────────────────────────
  if (mode === "edit" && editingIntegration) {
    const events = providerEventTypes[editingIntegration.provider] ?? [];

    return (
      <div className="max-w-4xl">
        <PageHeader
          title={`Edit: ${editingIntegration.name}`}
          actions={
            <div className="flex gap-2">
              <Button onClick={resetForm}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit} disabled={updateTemplates.isPending}>
                {updateTemplates.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          }
        />
        {err ? <p className="mb-4 text-sm text-red-400">{err}</p> : null}

        <div className="mb-4">
          <Field label="Event type">
            <Select value={editEventType} onChange={(e) => onEditEventChange(e.target.value)}>
              {events.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            {editTemplate ? (
              <TemplateEditor template={editTemplate} onChange={setEditTemplate} />
            ) : (
              <p className="text-sm text-zinc-500">No template for this event.</p>
            )}
          </div>
          <div>
            <p className="mb-3 text-xs font-medium text-zinc-400">Preview</p>
            {editTemplate ? (
              <PreviewPanel
                template={editTemplate}
                provider={editingIntegration.provider}
                eventType={editEventType}
                channels={editingIntegration.channels ?? []}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── List ─────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Integrations"
        actions={
          <Button variant="primary" onClick={() => setMode("create")}>
            New integration
          </Button>
        }
      />

      <p className="mb-4 text-xs text-zinc-500">
        Receive webhooks from external services. Each integration gets a unique URL
        that transforms the payload into a notification.
      </p>

      {list.isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : list.error ? (
        <p className="text-sm text-red-400">Failed to load.</p>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyList
          title="No integrations yet"
          hint="Create one to receive webhooks from GitHub, Mixpanel, etc."
        />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {list.data.map((intg) => (
            <li key={intg.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">{intg.name}</p>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {PROVIDER_LABELS[intg.provider] ?? intg.provider}
                    </span>
                    {(intg.channels ?? []).map((ch) => (
                      <span key={ch} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {ch}
                      </span>
                    ))}
                    {!intg.enabled ? (
                      <span className="rounded bg-red-950 px-2 py-0.5 text-xs text-red-300">
                        disabled
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Created {new Date(intg.created).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => startEdit(intg)}>Edit</Button>
                  <Button onClick={() => toggle.mutate({ id: intg.id, enabled: !intg.enabled })}>
                    {intg.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm("Delete this integration?")) remove.mutate(intg.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <label className="text-xs text-zinc-500">Webhook URL</label>
                <div className="mt-1 flex gap-2">
                  <input
                    readOnly
                    value={`${webhookBase}/api/webhook/${intg.id}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(`${webhookBase}/api/webhook/${intg.id}`)
                        .catch(() => {});
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
