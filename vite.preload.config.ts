import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["es"],
      entry: "electron/preload.ts",
      fileName: "preload",
    },
  },
});
