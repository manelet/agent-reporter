import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChannelRecord, ChannelType } from "@agent-reporter/shared";
import { Button, Field, Select, TextInput } from "../components/Field.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

const supportedTypes: { value: ChannelType; label: string }[] = [
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email (Resend)" },
];

export function ChannelFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("telegram");
  const [tg, setTg] = useState({ bot_token: "", chat_id: "" });
  const [email, setEmail] = useState({
    api_key: "",
    from_address: "",
    to_addresses: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["channel", id],
    queryFn: () =>
      api.get<ChannelRecord>(`/api/channels/${id}?reveal=true`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing.data) return;
    setName(existing.data.name);
    setType(existing.data.type);
    const cfg = existing.data.config as Record<string, unknown>;
    if (existing.data.type === "telegram") {
      setTg({
        bot_token: String(cfg.bot_token ?? ""),
        chat_id: String(cfg.chat_id ?? ""),
      });
    } else if (existing.data.type === "email") {
      const recipients = Array.isArray(cfg.to_addresses)
        ? (cfg.to_addresses as string[]).join(", ")
        : "";
      setEmail({
        api_key: String(cfg.api_key ?? ""),
        from_address: String(cfg.from_address ?? ""),
        to_addresses: recipients,
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      let configPayload: Record<string, unknown>;
      if (type === "telegram") {
        configPayload = { bot_token: tg.bot_token, chat_id: tg.chat_id };
      } else {
        const recipients = email.to_addresses
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        configPayload = {
          api_key: email.api_key,
          from_address: email.from_address,
          to_addresses: recipients,
        };
      }
      const body = { name, type, config: configPayload };
      if (isEdit) {
        await api.patch(`/api/channels/${id}`, body);
        return id;
      }
      const created = await api.post<{ id: string }>("/api/channels", body);
      return created.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      navigate("/channels");
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "save failed"),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/channels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      navigate("/channels");
    },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title={isEdit ? "Edit channel" : "New channel"} />

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
            placeholder="My Telegram"
          />
        </Field>

        <Field label="Type">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as ChannelType)}
          >
            {supportedTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {type === "telegram" ? (
          <>
            <Field label="Bot token" hint="From @BotFather. Encrypted at rest.">
              <TextInput
                type="password"
                required={!isEdit}
                value={tg.bot_token}
                onChange={(e) =>
                  setTg((p) => ({ ...p, bot_token: e.target.value }))
                }
                placeholder={isEdit ? "•••••• (leave blank to keep)" : "123:ABC"}
              />
            </Field>
            <Field
              label="Chat ID"
              hint="Your user/group/channel id (e.g. 123456789 or -100123…)."
            >
              <TextInput
                required
                value={tg.chat_id}
                onChange={(e) =>
                  setTg((p) => ({ ...p, chat_id: e.target.value }))
                }
                placeholder="123456789"
              />
            </Field>
          </>
        ) : null}

        {type === "email" ? (
          <>
            <Field
              label="Resend API key"
              hint="https://resend.com/api-keys. Encrypted at rest."
            >
              <TextInput
                type="password"
                required={!isEdit}
                value={email.api_key}
                onChange={(e) =>
                  setEmail((p) => ({ ...p, api_key: e.target.value }))
                }
                placeholder={isEdit ? "•••••• (leave blank to keep)" : "re_..."}
              />
            </Field>
            <Field
              label="From address"
              hint="Must match a verified domain in Resend."
            >
              <TextInput
                type="email"
                required
                value={email.from_address}
                onChange={(e) =>
                  setEmail((p) => ({ ...p, from_address: e.target.value }))
                }
                placeholder="reports@yourdomain.com"
              />
            </Field>
            <Field
              label="Recipients"
              hint="Comma-separated list of email addresses."
            >
              <TextInput
                required
                value={email.to_addresses}
                onChange={(e) =>
                  setEmail((p) => ({ ...p, to_addresses: e.target.value }))
                }
                placeholder="me@example.com, ops@example.com"
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
            onClick={() => navigate("/channels")}
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
                if (confirm("Delete this channel?")) remove.mutate();
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
