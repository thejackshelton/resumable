import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    runtimeConfig: {
      dataFetching: {
        defaultLimit: 2
      }
    },
    routeRules: {
      "/api/posts": {
        headers: {
          "x-data-fetching-route-rule": "posts"
        }
      },
      "/api/posts/**": {
        headers: {
          "x-data-fetching-route-rule": "post-detail"
        }
      },
      "/api/contact": {
        headers: {
          "x-data-fetching-route-rule": "contact"
        }
      }
    }
  }
});
