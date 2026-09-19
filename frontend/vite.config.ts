import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// data/vocabulary.json is the single source of truth for field names. It is
// imported at build time so the confirmation form cannot drift from the rule
// engine. In production this should be served by the backend instead, so that a
// vocabulary change does not require a frontend redeploy.
const dataDir = path.resolve(__dirname, "../data");

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@data": dataDir } },
  server: { port: 5173, fs: { allow: [path.resolve(__dirname), dataDir] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
