import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  // The @prism-wm/* deps are workspace symlinks we edit while developing the
  // package. Pre-bundling would serve a cached copy from node_modules/.vite,
  // so a source change silently kept showing the OLD adapter in the browser
  // (the CSS updated via HMR, the components did not). Excluded = always live.
  optimizeDeps: { exclude: ["@prism-wm/core", "@prism-wm/vue", "@prism-wm/react", "@prism-wm/svelte", "@prism-wm/styles"] },
});
