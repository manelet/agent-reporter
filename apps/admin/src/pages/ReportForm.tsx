import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  ChannelRecord,
  ReportRecord,
  SourceRecord,
  Trigger,
} from "@agent-reporter/shared";
import { Button, Field, Select, TextInput } from "../components/Field.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface TemplateMeta {
  id: string;
  description: string;
  sourceType: string;
}

const PUSH_SOURCE_TYPES = new Set(["github-actions"]);

function isPushSource(type: string | undefined): boolean {
  return type ? PUSH_SOURCE_TYPES.has(type) : false;
}

export function ReportFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("cron");
  const [cron, setCron] = useState("0 9 * * *");
  const [enabled, setEnabled] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => api.get<SourceRecord[]>("/api/sources"),
  });
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.get<ChannelRecord[]>("/api/channels"),
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<TemplateMeta[]>("/api/templates"),
  });
  const existing = useQuery({
    queryKey: ["report", id, "with-secret"],
    queryFn: () =>
      api.get<ReportRecord>(`/api/reports/${id}?reveal=true`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing.data) return;
    setName(existing.data.name);
    setSourceId(existing.data.source);
    setChannelIds(existing.data.channels);
    setTemplateId(existing.data.template_id);
    setTrigger(existing.data.trigger);
    setCron(existing.data.cron ?? "");
    setEnabled(existing.data.enabled);
  }, [existing.data]);

  const selectedSource = sources.data?.find((s) => s.id === sourceId);
  const sourceType = selectedSource?.type;
  const isPush = isPushSource(sourceType);

  const compatibleTemplates = useMemo(
    () =>
      templates.data?.filter(
        (t) => !sourceType || t.sourceType === sourceType,
      ) ?? [],
    [templates.data, sourceType],
  );

  useEffect(() => {
    if (!sourceType) return;
    setTrigger(isPushSource(sourceType) ? "webhook" : "cron");
    if (
      templateId &&
      templates.data &&
      !templates.data.some(
        (t) => t.id === templateId && t.sourceType === sourceType,
      )
    ) {
      setTemplateId("");
    }
  }, [sourceType, templates.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        source: sourceId,
        channels: channelIds,
        template_id: templateId,
        trigger,
        enabled,
      };
      if (trigger === "cron") body.cron = cron;
      if (isEdit) {
        await api.patch(`/api/reports/${id}`, body);
        return id;
      }
      const created = await api.post<{ id: string }>("/api/reports", body);
      return created.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      navigate("/reports");
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "save failed"),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      navigate("/reports");
    },
  });

  const regenerate = useMutation({
    mutationFn: () =>
      api.post<{ webhook_secret: string }>(
        `/api/reports/${id}/regenerate-secret`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report", id, "with-secret"] });
    },
  });

  const toggleChannel = (chId: string) => {
    setChannelIds((prev) =>
      prev.includes(chId) ? prev.filter((x) => x !== chId) : [...prev, chId],
    );
  };

  return (
    <div className="max-w-xl">
      <PageHeader title={isEdit ? "Edit report" : "New report"} />

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
            placeholder="Daily summary"
          />
        </Field>

        <Field label="Source">
          <Select
            required
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">— select —</option>
            {sources.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Channels"
          hint="Select one or more channels to receive this report."
        >
          <div className="space-y-1 rounded border border-zinc-700 bg-zinc-950 p-2">
            {(channels.data ?? []).length === 0 ? (
              <p className="px-1 py-1 text-xs text-zinc-500">
                No channels yet.{" "}
                <a className="underline" href="/channels/new">
                  Create one
                </a>
                .
              </p>
            ) : (
              channels.data?.map((ch) => (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-900 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={channelIds.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                  />
                  <span className="text-zinc-200">{ch.name}</span>
                  <span className="text-xs text-zinc-500">{ch.type}</span>
                </label>
              ))
            )}
          </div>
        </Field>

        <Field label="Template">
          <Select
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— select —</option>
            {compatibleTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Trigger"
          hint={
            isPush
              ? "Push sources receive webhooks; no cron."
              : "Pull sources are scheduled via cron."
          }
        >
          <Select
            value={trigger}
            disabled
            onChange={(e) => setTrigger(e.target.value as Trigger)}
          >
            <option value="cron">cron</option>
            <option value="webhook">webhook</option>
          </Select>
        </Field>

        {trigger === "cron" ? (
          <Field
            label="Cron expression"
            hint="Timezone Europe/Madrid. Example: 0 9 * * * (daily at 9am)."
          >
            <TextInput
              required
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 9 * * *"
            />
          </Field>
        ) : null}

        {trigger === "webhook" && isEdit && existing.data ? (
          <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-xs font-medium text-zinc-300">Webhook setup</p>
            <p className="text-xs text-zinc-500">
              In GitHub: Settings → Webhooks → Add webhook. Use Content type{" "}
              <code className="text-zinc-300">application/json</code> and send
              the <code className="text-zinc-300">workflow_run</code> event.
            </p>
            <Field label="Payload URL (path)">
              <TextInput
                readOnly
                value={existing.data.webhook_path ?? ""}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <Field
              label="Secret"
              hint="Paste this into GitHub's webhook secret field. Regenerate to rotate."
            >
              <div className="flex gap-2">
                <TextInput
                  readOnly
                  value={existing.data.webhook_secret ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono"
                />
                <Button
                  type="button"
                  onClick={() => regenerate.mutate()}
                  disabled={regenerate.isPending}
                >
                  {regenerate.isPending ? "…" : "Regenerate"}
                </Button>
              </div>
            </Field>
          </div>
        ) : null}

        {trigger === "webhook" && !isEdit ? (
          <p className="text-xs text-zinc-500">
            A webhook URL and HMAC secret will be generated when you save this
            report.
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="text-zinc-200">Enabled</span>
        </label>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            onClick={() => navigate("/reports")}
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
                if (confirm("Delete this report?")) remove.mutate();
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
