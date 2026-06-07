import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "NovelReader",
        short_name: "NovelReader",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0710",
        theme_color: "#0b0710",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ],
  build: { outDir: "dist" },
  server: { proxy: { "/api": "http://localhost:3001" } }
});
