import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SourceRecord, SourceType } from "@agent-reporter/shared";
import { Button, Field, Select, TextInput } from "../components/Field.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface CustomApiConfig {
  url: string;
  bearer_token?: string;
  timeout_ms?: number;
}

const supportedTypes: { value: SourceType; label: string }[] = [
  { value: "custom-api", label: "Custom API" },
  // Future types appear here as they are implemented.
];

export function SourceFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<SourceType>("custom-api");
  const [url, setUrl] = useState("");
  const [bearer, setBearer] = useState("");
  const [revealed, setRevealed] = useState(false);
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
    const cfg = existing.data.config as Partial<CustomApiConfig>;
    setUrl(cfg.url ?? "");
    setBearer(cfg.bearer_token ?? "");
    setRevealed(true);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const config: CustomApiConfig = { url };
      if (bearer) config.bearer_token = bearer;
      const body = { name, type, config };
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
            onChange={(e) => setType(e.target.value as SourceType)}
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
              hint="Endpoint returning the standard JSON payload (title/sections/metrics)."
            >
              <TextInput
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/daily-report"
              />
            </Field>
            <Field
              label="Bearer token (optional)"
              hint="Encrypted at rest with AES-256-GCM."
            >
              <TextInput
                type={revealed ? "text" : "password"}
                value={bearer}
                onChange={(e) => setBearer(e.target.value)}
                placeholder={
                  isEdit && !revealed ? "•••••• (current value hidden)" : ""
                }
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
