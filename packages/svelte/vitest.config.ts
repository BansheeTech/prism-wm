import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      "@prism-wm/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
    },
    conditions: ["browser"],
  },
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
