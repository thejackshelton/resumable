import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
