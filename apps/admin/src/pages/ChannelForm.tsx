import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChannelRecord, ChannelType } from "@agent-reporter/shared";
import { Button, Field, Select, TextInput } from "../components/Field.js";
import { PageHeader } from "../components/PageHeader.js";
import { api } from "../lib/api.js";

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
}

const supportedTypes: { value: ChannelType; label: string }[] = [
  { value: "telegram", label: "Telegram" },
  // email comes in M3.
];

export function ChannelFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("telegram");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
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
    const cfg = existing.data.config as Partial<TelegramConfig>;
    setBotToken(cfg.bot_token ?? "");
    setChatId(cfg.chat_id ?? "");
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        type,
        config: { bot_token: botToken, chat_id: chatId },
      };
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
            <Field
              label="Bot token"
              hint="From @BotFather. Encrypted at rest."
            >
              <TextInput
                type="password"
                required
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
              />
            </Field>
            <Field
              label="Chat ID"
              hint="Your user/group/channel id (e.g. 123456789 or -100123…)."
            >
              <TextInput
                required
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="123456789"
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
