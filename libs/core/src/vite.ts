import { nitro } from "nitro/vite";
import { qwik } from "qwik-bundler/vite";
import type { Plugin, PluginOption } from "vite";

export interface ResumableOptions {}

export function resumable(_options: ResumableOptions = {}): PluginOption[] {
  return [resumablePlugin(), nitro(), qwik()];
}

function resumablePlugin(): Plugin {
  return {
    name: "resumable:vite"
  };
}
