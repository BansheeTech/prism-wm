import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The @prism-wm/* deps are workspace symlinks we edit while developing the
  // package. Pre-bundling would serve a cached copy from node_modules/.vite,
  // so a source change silently kept showing the OLD adapter in the browser
  // (the CSS updated via HMR, the components did not). Excluded = always live.
  optimizeDeps: { exclude: ["@prism-wm/core", "@prism-wm/vue", "@prism-wm/react", "@prism-wm/svelte", "@prism-wm/styles"] },
});
