import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { LoginPage } from "./pages/Login.js";
import { TokensPage } from "./pages/Tokens.js";
import { LogsPage } from "./pages/Logs.js";
import { IntegrationsPage } from "./pages/Integrations.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/tokens" replace />} />
        <Route path="/tokens" element={<TokensPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/logs" element={<LogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/tokens" replace />} />
    </Routes>
  );
}
