import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],
        ],
      },
    }),
    VitePWA({
      base: "/",
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: "PayLess",
        short_name: "PayLess",
        theme_color: "#111111",
        icons: [
          {
            src: "payless.webp",
            type: "image/webp",
            sizes: "192x192",
            purpose: "maskable",
          },
          {
            src: "payless.webp",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/webp",
          },
          {
            src: "payless.webp",
            type: "image/webp",
            sizes: "192x192",
          },
          {
            src: "payless.webp",
            type: "image/webp",
            sizes: "512x512",
          },
        ],
        display: "standalone",
        start_url: "/",
        background_color: "#111111",
        description: "View with PayLess - Skip paywalls easily",
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
  resolve: {
    alias: {
      "@": "./src",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          utils: ["axios", "isomorphic-dompurify", "node-html-parser"],
        },
      },
    },
    sourcemap: false,
    minify: "esbuild",
  },
  server: {
    hmr: {
      overlay: true,
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
});
