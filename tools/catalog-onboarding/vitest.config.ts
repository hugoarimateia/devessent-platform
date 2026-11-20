import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@scanner": path.resolve(__dirname, "./src"),
      "@": path.resolve(__dirname, "../../src"),
    },
  },
});
