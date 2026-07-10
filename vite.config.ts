import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "tiptap-vendor": [
            "@tiptap/react",
            "@tiptap/core",
            "@tiptap/starter-kit",
            "@tiptap/extension-underline",
            "@tiptap/extension-placeholder",
            "@tiptap/extension-link",
            "@tiptap/extension-task-list",
            "@tiptap/extension-task-item",
            "@tiptap/extension-highlight",
            "@tiptap/extension-text-align",
            "@tiptap/markdown",
            "@tiptap/extension-image",
          ],
          "lucide": ["lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
