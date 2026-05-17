import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SourceRecord, SourceType } from "@agent-reporter/shared";
import { Button, Field, Select, TextInput } from "../components/Field.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

const supportedTypes: { value: SourceType; label: string }[] = [
  { value: "custom-api", label: "Custom API (pull, emits Notification)" },
  { value: "github-actions", label: "GitHub Actions (push, needs template)" },
  {
    value: "notification-webhook",
    label: "Notification webhook (push, emits Notification)",
  },
  { value: "sentry", label: "Sentry (pull, needs template)" },
];

type AnyConfig = Record<string, string>;

export function SourceFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<SourceType>("custom-api");
  const [config, setConfig] = useState<AnyConfig>({});
  const [err, setErr] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["source", id],
    queryFn: () =>
      api.get<SourceRecord>(`/api/sources/${id}?reveal=true`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing.data) return;
    setName(existing.data.name);
    setType(existing.data.type);
    const cfg: AnyConfig = {};
    for (const [k, v] of Object.entries(existing.data.config)) {
      cfg[k] = typeof v === "string" ? v : String(v ?? "");
    }
    setConfig(cfg);
  }, [existing.data]);

  const setField = (k: string, v: string) =>
    setConfig((prev) => ({ ...prev, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(config)) {
        if (v.trim().length > 0) cleaned[k] = v;
      }
      const body = { name, type, config: cleaned };
      if (isEdit) {
        await api.patch(`/api/sources/${id}`, body);
        return id;
      }
      const created = await api.post<{ id: string }>("/api/sources", body);
      return created.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      navigate("/sources");
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "save failed"),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      navigate("/sources");
    },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title={isEdit ? "Edit source" : "New source"} />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          save.mutate();
        }}
      >
        <Field label="Name">
          <TextInput
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API"
          />
        </Field>

        <Field label="Type">
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value as SourceType);
              setConfig({});
            }}
          >
            {supportedTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {type === "custom-api" ? (
          <>
            <Field
              label="URL"
              hint="Endpoint returning a Notification JSON payload (title + optional body/level/sections/metadata/links)."
            >
              <TextInput
                type="url"
                required
                value={config.url ?? ""}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://api.example.com/daily-report"
              />
            </Field>
            <Field
              label="Bearer token (optional)"
              hint="Encrypted at rest with AES-256-GCM."
            >
              <TextInput
                type="password"
                value={config.bearer_token ?? ""}
                onChange={(e) => setField("bearer_token", e.target.value)}
                placeholder={isEdit ? "•••••• (leave blank to keep)" : ""}
              />
            </Field>
          </>
        ) : null}

        {type === "notification-webhook" ? (
          <p className="rounded border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
            No source-level config. The webhook URL and HMAC secret are
            generated per report when its trigger is set to webhook. POST a
            Notification JSON body signed with
            <code className="mx-1 text-zinc-300">X-Signature-256: sha256=…</code>.
          </p>
        ) : null}

        {type === "github-actions" ? (
          <>
            <Field
              label="Repository"
              hint="owner/name. Webhooks from other repos are ignored."
            >
              <TextInput
                required
                value={config.repo ?? ""}
                onChange={(e) => setField("repo", e.target.value)}
                placeholder="acme/web"
              />
            </Field>
            <Field
              label="Workflow name (optional)"
              hint="If set, only this workflow's runs will be considered."
            >
              <TextInput
                value={config.workflow_name ?? ""}
                onChange={(e) => setField("workflow_name", e.target.value)}
                placeholder="CI"
              />
            </Field>
            <p className="text-xs text-zinc-500">
              The webhook URL and HMAC secret live on the report (auto-generated
              when you set its trigger to webhook).
            </p>
          </>
        ) : null}

        {type === "sentry" ? (
          <>
            <Field
              label="Auth token"
              hint="Personal or internal-integration token with event:read + project:read."
            >
              <TextInput
                type="password"
                required={!isEdit}
                value={config.token ?? ""}
                onChange={(e) => setField("token", e.target.value)}
                placeholder={isEdit ? "•••••• (leave blank to keep)" : ""}
              />
            </Field>
            <Field label="Organization slug">
              <TextInput
                required
                value={config.organization_slug ?? ""}
                onChange={(e) => setField("organization_slug", e.target.value)}
                placeholder="acme"
              />
            </Field>
            <Field label="Project slug">
              <TextInput
                required
                value={config.project_slug ?? ""}
                onChange={(e) => setField("project_slug", e.target.value)}
                placeholder="web"
              />
            </Field>
            <Field
              label="Base URL (optional)"
              hint="Defaults to https://sentry.io. Override for self-hosted."
            >
              <TextInput
                type="url"
                value={config.base_url ?? ""}
                onChange={(e) => setField("base_url", e.target.value)}
                placeholder="https://sentry.io"
              />
            </Field>
          </>
        ) : null}

        {err ? <p className="text-sm text-red-400">{err}</p> : null}

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            onClick={() => navigate("/sources")}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          {isEdit ? (
            <Button
              type="button"
              variant="danger"
              className="ml-auto"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("Delete this source?")) remove.mutate();
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
