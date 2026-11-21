import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", EMAIL_PROVIDER: "memory", APP_URL: "http://localhost:3000" },
    fileParallelism: false,
    hookTimeout: 60000,
  },
});
