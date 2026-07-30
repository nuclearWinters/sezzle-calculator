/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

const fixStylexWindowsPaths: Plugin = {
  name: "fix-stylex-windows-dev-paths",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html.replace(/(src|href)="([^"]*\\[^"]*)"/g, (_match, attr: string, value: string) => {
        return `${attr}="${value.replace(/[\\/]+/g, "/")}"`;
      }),
  },
};

export default defineConfig({
  plugins: [stylex.vite(), react(), fixStylexWindowsPaths],
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/**/*.test.{ts,tsx}"],
    },
  },
});
