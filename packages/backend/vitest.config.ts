import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/__tests__/global-setup.ts",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
