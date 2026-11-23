import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  esbuild: { jsx: "automatic" }, // match Next.js so .tsx components render in tests
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", EMAIL_PROVIDER: "memory", APP_URL: "http://localhost:3000" },
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 20000,
  },
});
