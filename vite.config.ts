import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite.ts";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), svelte({ configFile: "../../svelte.config.js" })],
	root: "src/mainview",
	resolve: {
		alias: [
			{ find: "$lib", replacement: path.resolve(projectRoot, "src/mainview/lib") },
			...electrobunViteAliases(path.resolve(projectRoot, ".hutch/devkit")),
		],
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
