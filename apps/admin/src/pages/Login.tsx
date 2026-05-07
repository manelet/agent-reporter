import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { setToken } from "../lib/auth.js";

interface LoginResponse {
  token: string;
  user: { id: string; email: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });
      setToken(res.token);
      navigate("/reports");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center">
      <form
        onSubmit={submit}
        className="w-80 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-zinc-400">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 outline-none focus:border-zinc-500"
          />
        </label>
        {err ? (
          <p className="mb-3 text-sm text-red-400">{err}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-3 text-xs text-zinc-500">
          Use your PocketBase superuser credentials.
        </p>
      </form>
    </div>
  );
}
