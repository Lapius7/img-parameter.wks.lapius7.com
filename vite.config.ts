import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
	root: "web",
	publicDir: "public",
	plugins: [react(), tailwindcss()],
	resolve: { alias: { "@": path.resolve(__dirname, "web/src") } },
	build: { outDir: "../public", emptyOutDir: true },
});
