import { describe, expect, it } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import type { EnvironmentOptions, Plugin, UserConfig } from "vite";
import { nitro } from "nitro/vite";
import { resumable } from "./vite.ts";

const flattenPlugins = (plugins: unknown[]): Plugin[] =>
  plugins.flatMap((plugin) =>
    Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]
  ) as Plugin[];

const hookHandler = (hook: unknown) => {
  if (typeof hook === "function") {
    return hook;
  }

  if (
    typeof hook === "object" &&
    hook !== null &&
    "handler" in hook &&
    typeof hook.handler === "function"
  ) {
    return hook.handler;
  }

  return undefined;
};

describe("resumable Vite plugin", () => {
  it("wires Nitro internally without adding Qwik", () => {
    const plugins = flattenPlugins([resumable()]);
    const names = plugins.map((plugin) => plugin.name);

    expect(names).toContain("resumable:vite");
    expect(names).toContain("nitro:init");
    expect(names).not.toContain("vite-plugin-qwik");
    expect(names).not.toContain("vite-plugin-qwik-post");
  });

  it("exposes environment-agnostic lazy page discovery through a virtual module", async () => {
    const plugins = flattenPlugins([resumable()]);
    const routesPlugin = plugins.find((plugin) => plugin.name === "resumable:routes");
    const resolveId = hookHandler(routesPlugin?.resolveId) as
      | ((id: string) => string | undefined)
      | undefined;
    const load = hookHandler(routesPlugin?.load) as
      | ((id: string) => string | Promise<string> | undefined)
      | undefined;

    expect(routesPlugin).toBeDefined();
    expect(routesPlugin).not.toHaveProperty("configureServer");
    expect(routesPlugin).not.toHaveProperty("handleHotUpdate");
    expect(routesPlugin).not.toHaveProperty("hotUpdate");
    expect(resolveId?.("virtual:resumable/routes")).toBe("\0virtual:resumable/routes");

    const code = await load?.("\0virtual:resumable/routes");

    expect(code).toContain('import { normalizeRouteFileId } from "@resumable.dev/core";');
    expect(code).toContain('import.meta.glob("/pages/**/*.tsx")');
    expect(code).toContain("export const pageModuleLoaders");
    expect(code).toContain("export const routeFileIds");
    expect(code).not.toContain('from "pathe"');
    expect(code).not.toContain('from "ufo"');
    expect(code).not.toContain("replace(/^\\\\/+");
  });

  it("preserves user top-level nitro config while adding minimal scan defaults", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const userConfig: UserConfig = {
      nitro: {
        preset: "bun",
        scanDirs: ["server"],
        routeRules: {
          "/health": { headers: { "x-health": "ok" } }
        }
      }
    };

    const result = plugin.config?.(userConfig, {
      command: "serve",
      mode: "development",
      isSsrBuild: false,
      isPreview: false
    });

    expect(result).toMatchObject({
      nitro: {
        preset: "bun",
        routeRules: {
          "/health": { headers: { "x-health": "ok" } }
        },
        apiDir: "api",
        routesDir: ".resumable/nitro-routes",
        scanDirs: [".", "server"]
      }
    });
  });

  it("sets environment entries from consumer using rolldownOptions", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const configEnvironment = hookHandler(plugin.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;

    expect(configEnvironment).toBeDefined();

    const clientResult = configEnvironment?.("browser", {
      consumer: "client",
      build: {
        rolldownOptions: {}
      }
    });
    const serverResult = configEnvironment?.("server-function", {
      consumer: "server",
      build: {
        rolldownOptions: {
          external: ["nitro"]
        }
      }
    });

    expect(clientResult).toMatchObject({
      build: {
        rolldownOptions: {
          input: "virtual:resumable/client-entry"
        }
      }
    });
    expect(serverResult).toMatchObject({
      build: {
        rolldownOptions: {
          external: ["nitro"],
          input: "virtual:resumable/server-entry"
        }
      }
    });
  });

  it("preserves environment rolldown input choices", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const configEnvironment = hookHandler(plugin.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;

    const result = configEnvironment?.("custom", {
      consumer: "server",
      build: {
        rolldownOptions: {
          input: "custom-server-entry.ts"
        }
      }
    });

    expect(result).toMatchObject({
      build: {
        rolldownOptions: {
          input: "custom-server-entry.ts"
        }
      }
    });
  });

  it("throws when users add nitro() directly alongside resumable()", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const directNitro = nitro();
    const userConfig: UserConfig = {
      plugins: [directNitro]
    };

    expect(() =>
      plugin.config?.(userConfig, {
        command: "serve",
        mode: "development",
        isSsrBuild: false,
        isPreview: false
      })
    ).toThrow("Remove nitro() from vite.config.ts");
  });

  it("uses Vite plugin helpers instead of local plugin-flattening ceremony", async () => {
    const source = await readFile(new URL("./vite.ts", import.meta.url), "utf-8");

    expect(source).toContain("sortUserPlugins");
    expect(source).not.toContain("function flattenPlugins");
    expect(source).not.toContain("...nitroPlugins");
  });

  it("uses Vite environment hooks instead of name-specific environment input helpers", async () => {
    const source = await readFile(new URL("./vite.ts", import.meta.url), "utf-8");

    expect(source).toContain("configEnvironment");
    expect(source).toContain(".consumer");
    expect(source).toContain("rolldownOptions");
    expect(source).not.toContain("rollupOptions");
    expect(source).not.toContain("createEnvironmentConfig");
    expect(source).not.toContain("createEnvironmentWithInput");
    expect(source).not.toContain("environments?.client");
    expect(source).not.toContain("environments?.ssr");
  });
});
