import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  // Prevent Vitest from using the root vite.config.ts which has the Cloudflare plugin
  configFile: false,
});
