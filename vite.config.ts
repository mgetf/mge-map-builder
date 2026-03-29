import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
	plugins: [tailwindcss(), svelte({ configFile: "../../svelte.config.js" })],
	root: "src/mainview",
	resolve: {
		alias: {
			$lib: path.resolve("src/mainview/lib"),
		},
	},
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
