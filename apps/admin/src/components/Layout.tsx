import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../lib/auth.js";

const navItems = [
  { to: "/tokens", label: "Tokens" },
  { to: "/integrations", label: "Integrations" },
  { to: "/logs", label: "Logs" },
];

export function Layout() {
  const navigate = useNavigate();
  const onLogout = () => {
    clearToken();
    navigate("/login");
  };
  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-6 text-sm font-semibold tracking-wide text-zinc-300">
          reporter
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded px-3 py-1.5 transition ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="mt-8 w-full rounded px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
