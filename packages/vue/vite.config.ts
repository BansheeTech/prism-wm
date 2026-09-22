import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// One source of truth for the licence header. See licenseBanner below.
const banner = readFileSync(
  fileURLToPath(new URL("../../scripts/license-header.txt", import.meta.url)),
  "utf8",
).trim();

// Bundling dissolves the source files, and with them the licence header at the
// top of each one; esbuild's minifier then drops any comment it does not
// recognise as legal. So the header is pasted back in generateBundle, which
// runs after every transform, the way Vue stamps its own dist.
//
// A plugin rather than rollupOptions.output.banner: Vite builds its own output
// options in library mode and the banner never reaches Rollup.
const licenseBanner = {
  name: "pwm-license-banner",
  enforce: "post" as const,
  generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
    for (const file of Object.values(bundle)) {
      if (file.type === "chunk" && file.code) file.code = `${banner}\n${file.code}`;
    }
  },
};

export default defineConfig({
  plugins: [vue(), licenseBanner, dts({ tsconfigPath: "./tsconfig.json", include: ["src"] })],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue", "@prism-wm/core"],
    },
    // A library ships readable. Whoever installs this runs their own bundler,
    // which minifies the final app, and it does that better from readable input
    // than from already-mangled names. It also keeps stack traces meaningful
    // for anyone debugging into Prism, and keeps what we publish as AGPL source
    // actually readable. Vite defaults this to esbuild in library mode.
    minify: false,
    outDir: "dist",
    emptyOutDir: true,
  },
});
