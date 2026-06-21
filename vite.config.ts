import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
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
