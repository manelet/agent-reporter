import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// When running standalone (no portless) override via VITE_API_URL.
const API_TARGET =
  process.env.VITE_API_URL ?? "https://api.agent-reporter.localhost";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
