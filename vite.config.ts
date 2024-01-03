import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      base: "/",
      registerType: "autoUpdate",
      manifest: {
        name: "PayLess",
        short_name: "PayLess",
        theme_color: "#111111",
        icons: [
          {
            src: "payless.png",
            type: "image/png",
            sizes: "192x192",
            purpose: "maskable",
          },
          {
            src: "payless.png",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon",
          },
          {
            src: "payless.png",
            type: "image/png",
            sizes: "192x192",
          },
          {
            src: "payless.png",
            type: "image/png",
            sizes: "512x512",
          },
        ],
        display: "standalone",
        start_url: "/",
        background_color: "#111111",
        description: "View with PayLess",
        share_target: {
          action: "/",
          method: "GET",
          enctype: "application/x-www-form-urlencoded",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
      },
    }),
  ],
});
