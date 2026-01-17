import { fileURLToPath, URL } from "node:url";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	ssr: {
		noExternal: ["better-auth"],
		external: ["better-sqlite3", "drizzle-orm"],
	},
	optimizeDeps: {
		exclude: ["better-sqlite3", "drizzle-orm/better-sqlite3"],
	},
	build: {
		rollupOptions: {
			external: ["better-sqlite3"],
		},
	},
	plugins: [
		devtools(),
		nitro(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
