import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { ChannelFormPage } from "./pages/ChannelForm.js";
import { ChannelsPage } from "./pages/Channels.js";
import { LoginPage } from "./pages/Login.js";
import { ReportFormPage } from "./pages/ReportForm.js";
import { ReportsPage } from "./pages/Reports.js";
import { RunDetailPage } from "./pages/RunDetail.js";
import { RunsPage } from "./pages/Runs.js";
import { SourceFormPage } from "./pages/SourceForm.js";
import { SourcesPage } from "./pages/Sources.js";
import { TemplatePreviewPage } from "./pages/TemplatePreview.js";
import { TemplatesPage } from "./pages/Templates.js";

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
        <Route index element={<Navigate to="/reports" replace />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/sources/new" element={<SourceFormPage />} />
        <Route path="/sources/:id/edit" element={<SourceFormPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/channels/new" element={<ChannelFormPage />} />
        <Route path="/channels/:id/edit" element={<ChannelFormPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/new" element={<ReportFormPage />} />
        <Route path="/reports/:id/edit" element={<ReportFormPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route
          path="/templates/:id/preview"
          element={<TemplatePreviewPage />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/reports" replace />} />
    </Routes>
  );
}
