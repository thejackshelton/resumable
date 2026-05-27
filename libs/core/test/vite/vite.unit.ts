import { describe, expect, it, vi } from "vite-plus/test";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "pathe";
import { decodePath, parseURL } from "ufo";
import type { EnvironmentOptions, Plugin, UserConfig } from "vite";
import { nitro } from "nitro/vite";
import { resumable } from "../../src/vite/vite.ts";

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

const expectedEntryPath = (file: string) =>
  join(
    dirname(decodePath(parseURL(import.meta.url).pathname)),
    "../../src/vite/entries",
    file
  );

describe("resumable Vite plugin", () => {
  it("wires Nitro internally without adding Qwik", () => {
    const plugins = flattenPlugins([resumable()]);
    const names = plugins.map((plugin) => plugin.name);

    expect(names).toContain("resumable:vite");
    expect(names).toContain("resumable:mdx");
    expect(names).toContain("resumable:typegen");
    expect(names).toContain("resumable:anchors");
    expect(names).toContain("resumable:html");
    expect(names).toContain("nitro:init");
    expect(names).not.toContain("vite-plugin-qwik");
    expect(names).not.toContain("vite-plugin-qwik-post");
  });

  it("runs the html transform in normal plugin order", () => {
    const plugins = flattenPlugins([resumable()]);
    const anchorPlugin = plugins.find((plugin) => plugin.name === "resumable:anchors");
    const htmlPlugin = plugins.find((plugin) => plugin.name === "resumable:html");
    const mdxPlugin = plugins.find((plugin) => plugin.name === "resumable:mdx");

    expect(mdxPlugin).toBeDefined();
    expect(mdxPlugin?.enforce).toBe("pre");
    expect(anchorPlugin).toBeDefined();
    expect(anchorPlugin).not.toHaveProperty("enforce");
    expect((anchorPlugin?.transform as { order?: string } | undefined)?.order).toBe(
      "pre"
    );
    expect(htmlPlugin).toBeDefined();
    expect(htmlPlugin).not.toHaveProperty("enforce");
    expect((htmlPlugin?.transform as { order?: string } | undefined)?.order).toBe("pre");
    expect(plugins.findIndex((plugin) => plugin.name === "resumable:vite")).toBeLessThan(
      plugins.findIndex((plugin) => plugin.name === "resumable:anchors")
    );
    expect(
      plugins.findIndex((plugin) => plugin.name === "resumable:anchors")
    ).toBeLessThan(plugins.findIndex((plugin) => plugin.name === "resumable:html"));
    expect(plugins.findIndex((plugin) => plugin.name === "resumable:html")).toBeLessThan(
      plugins.findIndex((plugin) => plugin.name === "nitro:init")
    );
  });

  it("exposes environment-agnostic lazy page discovery through a virtual module", async () => {
    const plugins = flattenPlugins([resumable()]);
    const routesPlugin = plugins.find((plugin) => plugin.name === "resumable:routes");
    const resolveId = hookHandler(routesPlugin?.resolveId) as
      | ((id: string) => string | undefined)
      | undefined;

    expect(routesPlugin).toBeDefined();
    expect(routesPlugin).not.toHaveProperty("configureServer");
    expect(routesPlugin).not.toHaveProperty("handleHotUpdate");
    expect(routesPlugin).not.toHaveProperty("hotUpdate");

    expect(resolveId?.("virtual:resumable/routes")).toBe(
      expectedEntryPath("route-discovery.ts")
    );
    const entrySource = await readFile(
      new URL("../../src/vite/entries/route-discovery.ts", import.meta.url),
      "utf-8"
    );
    const pluginSource = await readFile(
      new URL("../../src/vite/vite.ts", import.meta.url),
      "utf-8"
    );

    expect(entrySource).toContain(
      'import.meta.glob(["/pages/**/*.tsx", "/pages/**/*.mdx"])'
    );
    expect(entrySource).toContain("createRouteDiscovery");
    expect(entrySource).toContain("pageModuleLoaders");
    expect(entrySource).toContain("routeFileIds");
    expect(pluginSource).toContain("filter: {");
    expect(pluginSource).not.toContain("transformWithOxc");
    expect(pluginSource).not.toContain("this.fs");
    expect(pluginSource).not.toContain("readFile(");
    expect(pluginSource).not.toContain('"node:');
    expect(pluginSource).not.toContain("'node:");
    expect(pluginSource).not.toContain("fileURLToPath");
    expect(pluginSource).not.toContain('import.meta.glob("/pages/**/*.tsx")');
    expect(pluginSource).not.toContain("const routeDiscovery = createRouteDiscovery");
    expect(entrySource).not.toContain('from "pathe"');
    expect(entrySource).not.toContain('from "ufo"');
    expect(entrySource).not.toContain("replace(/^\\\\/+");
  });

  it("discovers document.tsx and document.jsx from the generated entries without a separate document module", async () => {
    const plugins = flattenPlugins([resumable()]);
    const routesPlugin = plugins.find((plugin) => plugin.name === "resumable:routes");
    const resolveId = hookHandler(routesPlugin?.resolveId) as
      | ((id: string) => string | undefined)
      | undefined;

    expect(routesPlugin).toBeDefined();
    expect(resolveId?.("virtual:resumable/document")).toBeUndefined();

    expect(resolveId?.("virtual:resumable/client-entry")).toBe(
      expectedEntryPath("client-entry.ts")
    );
    expect(resolveId?.("virtual:resumable/client-entry-path")).toBe(
      "virtual:resumable/client-entry-path"
    );
    expect(resolveId?.("virtual:resumable/server-entry")).toBe(
      expectedEntryPath("server-entry.ts")
    );
    expect(resolveId?.("virtual:resumable/route-href")).toBe(
      expectedEntryPath("route-href.ts")
    );
    const clientEntrySource = await readFile(
      new URL("../../src/vite/entries/client-entry.ts", import.meta.url),
      "utf-8"
    );
    const serverEntrySource = await readFile(
      new URL("../../src/vite/entries/server-entry.ts", import.meta.url),
      "utf-8"
    );
    const serverRuntimeSource = await readFile(
      new URL("../../src/vite/runtime/create-server-entry.ts", import.meta.url),
      "utf-8"
    );

    expect(serverEntrySource).toContain(
      "@resumable.dev/core/vite/runtime/create-server-entry"
    );
    expect(serverEntrySource).toContain("virtual:resumable/client-entry-path");
    expect(clientEntrySource).toContain(
      'export const documentModules = import.meta.glob(["/document.tsx", "/document.jsx"])'
    );
    expect(clientEntrySource).toContain(
      'import.meta.glob(["/pages/**/*.tsx", "/pages/**/*.mdx"])'
    );
    expect(clientEntrySource).toContain("__resumableStartSpaNavigation");
    expect(serverEntrySource).toContain('from "@qwik.dev/core/jsx-runtime"');
    expect(serverEntrySource).toContain('from "@qwik.dev/core/server"');
    expect(serverEntrySource).toContain('from "@qwik.dev/core"');
    expect(serverEntrySource).toContain("createServerEntry");
    expect(clientEntrySource).toContain(
      'import.meta.glob(["/document.tsx", "/document.jsx"])'
    );
    expect(serverEntrySource).toContain(
      'import.meta.glob(["/document.tsx", "/document.jsx"])'
    );
    expect(clientEntrySource).not.toContain("/app.");
    expect(serverEntrySource).not.toContain("/app.");
    expect(clientEntrySource).not.toContain("appModules");
    expect(serverEntrySource).not.toContain("appModule");
    expect(clientEntrySource).not.toContain("createClientEntry");
    expect(serverEntrySource).not.toContain("getDocumentModuleLoader");
    expect(serverEntrySource).toContain('documentModuleLoaders["/document.tsx"] ??');
    expect(serverEntrySource).toContain('documentModuleLoaders["/document.jsx"]');
    expect(serverEntrySource).not.toContain("virtual:resumable/document");
    expect(serverEntrySource).toContain(
      'import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime"'
    );
    expect(serverEntrySource).toContain(
      'import { renderToString } from "@qwik.dev/core/server"'
    );
    expect(serverEntrySource).toContain("ResumableRouteRoot");
    expect(serverRuntimeSource).toContain("qwik: QwikRenderRuntime");
    expect(serverRuntimeSource).toContain("renderBodyContent(");
    expect(serverRuntimeSource).not.toContain("escapeHtmlAttribute");
    expect(serverRuntimeSource).not.toContain('html.indexOf("</head>")');
    expect(serverRuntimeSource).not.toContain(
      'import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime"'
    );
    expect(serverRuntimeSource).not.toContain(
      'import { renderToString } from "@qwik.dev/core/server"'
    );
    expect(serverRuntimeSource).not.toContain("unsupportedDocumentShell");
    expect(serverRuntimeSource).not.toContain("resumable-html");
    expect(serverRuntimeSource).not.toContain("node:fs");
    expect(serverRuntimeSource).not.toContain("node:path");
  });

  it("builds runtime subpaths and ships raw virtual entry source files", async () => {
    const serverRuntimeOutputUrl = new URL(
      "../../lib/vite/runtime/create-server-entry.mjs",
      import.meta.url
    );
    const routeRuntimeOutputUrl = new URL(
      "../../lib/vite/runtime/create-route-discovery.mjs",
      import.meta.url
    );
    const rawServerEntryUrl = new URL(
      "../../lib/entries/server-entry.ts",
      import.meta.url
    );
    const rawRouteHrefEntryUrl = new URL(
      "../../lib/entries/route-href.ts",
      import.meta.url
    );
    const rawRouteRootEntryUrl = new URL(
      "../../lib/entries/route-root.tsx",
      import.meta.url
    );
    const deletedClientRuntimeOutputUrl = new URL(
      "../../lib/vite/runtime/create-client-entry.mjs",
      import.meta.url
    );
    const deletedDocumentModuleLoaderOutputUrl = new URL(
      "../../lib/vite/runtime/get-document-module-loader.mjs",
      import.meta.url
    );

    await expect(access(serverRuntimeOutputUrl)).resolves.toBeUndefined();
    await expect(access(routeRuntimeOutputUrl)).resolves.toBeUndefined();
    await expect(access(rawServerEntryUrl)).resolves.toBeUndefined();
    await expect(access(rawRouteHrefEntryUrl)).resolves.toBeUndefined();
    await expect(access(rawRouteRootEntryUrl)).resolves.toBeUndefined();
    await expect(access(deletedClientRuntimeOutputUrl)).rejects.toThrow();
    await expect(access(deletedDocumentModuleLoaderOutputUrl)).rejects.toThrow();

    const serverRuntimeOutput = await readFile(serverRuntimeOutputUrl, "utf-8");
    const rawServerEntryOutput = await readFile(rawServerEntryUrl, "utf-8");
    const rawRouteHrefEntryOutput = await readFile(rawRouteHrefEntryUrl, "utf-8");

    expect(serverRuntimeOutput).not.toContain("@qwik.dev/core/jsx-runtime");
    expect(serverRuntimeOutput).not.toContain("@qwik.dev/core/server");
    expect(serverRuntimeOutput).toContain("options.qwik");
    expect(rawServerEntryOutput).toContain("@qwik.dev/core/jsx-runtime");
    expect(rawServerEntryOutput).toContain(
      'import.meta.glob(["/document.tsx", "/document.jsx"])'
    );
    expect(rawRouteHrefEntryOutput).toContain("export function __resumableHref");
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
    expect(result).not.toHaveProperty("environments");
  });

  it("sets missing environment entries from consumer using rolldownOptions", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const configEnvironment = hookHandler(plugin.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;

    expect(configEnvironment).toBeDefined();

    const clientConfig: EnvironmentOptions = {
      consumer: "client",
      build: {
        rolldownOptions: {}
      }
    };
    const serverConfig: EnvironmentOptions = {
      consumer: "server",
      build: {
        rolldownOptions: {
          external: ["nitro"]
        }
      }
    };

    const clientResult = configEnvironment?.("browser", clientConfig);
    const serverResult = configEnvironment?.("server-function", serverConfig);

    expect(clientResult).toBeUndefined();
    expect(serverResult).toBeUndefined();
    expect(clientConfig).toMatchObject({
      build: {
        rolldownOptions: {
          input: "virtual:resumable/client-entry"
        }
      }
    });
    expect(serverConfig).toMatchObject({
      build: {
        rolldownOptions: {
          external: ["nitro"],
          input: "virtual:resumable/server-entry"
        }
      }
    });
  });

  it("uses Vite dependency config to keep Qwik on one runtime instance", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const configEnvironment = hookHandler(plugin.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;

    const config: EnvironmentOptions = {
      consumer: "server",
      resolve: {
        dedupe: ["user-singleton"],
        noExternal: ["user-runtime"]
      },
      optimizeDeps: {
        exclude: ["user-dependency"]
      }
    };

    const result = configEnvironment?.("ssr", config);

    expect(result).toBeUndefined();
    expect(config.resolve?.dedupe).toEqual(["user-singleton", "@qwik.dev/core"]);
    expect(config.optimizeDeps?.exclude).toEqual(["user-dependency", "@qwik.dev/core"]);
    expect(config.resolve?.noExternal).toHaveLength(2);
    expect(config.resolve?.noExternal?.[0]).toBe("user-runtime");
    expect(String(config.resolve?.noExternal?.[1])).toBe(
      "/^@qwik\\.dev\\/core(?:\\/.*)?$/"
    );
  });

  it("preserves environment rolldown input choices", () => {
    const [plugin] = flattenPlugins([resumable()]);
    const configEnvironment = hookHandler(plugin.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;

    const config: EnvironmentOptions = {
      consumer: "server",
      build: {
        rolldownOptions: {
          input: "custom-server-entry.ts"
        }
      }
    };
    const result = configEnvironment?.("custom", config);

    expect(result).toBeUndefined();
    expect(config).toMatchObject({
      build: {
        rolldownOptions: {
          input: "custom-server-entry.ts"
        }
      }
    });
  });

  it("captures the client entry asset through the Vite client environment", () => {
    const plugins = flattenPlugins([resumable()]);
    const vitePlugin = plugins.find((plugin) => plugin.name === "resumable:vite");
    const routesPlugin = plugins.find((plugin) => plugin.name === "resumable:routes");
    const configEnvironment = hookHandler(vitePlugin?.configEnvironment) as
      | ((name: string, config: EnvironmentOptions) => EnvironmentOptions | null | void)
      | undefined;
    const generateBundle = hookHandler(vitePlugin?.generateBundle) as
      | ((this: unknown, options: unknown, bundle: Record<string, unknown>) => void)
      | undefined;
    const load = hookHandler(routesPlugin?.load) as
      | ((id: string) => string | undefined)
      | undefined;

    (vitePlugin?.configResolved as ((config: { base: string }) => void) | undefined)?.({
      base: "/app/"
    });

    const clientConfig: EnvironmentOptions = {
      consumer: "client",
      build: {
        rolldownOptions: {
          input: "custom-client-entry.ts"
        }
      }
    };
    configEnvironment?.("client", clientConfig);
    expect(clientConfig.build?.rolldownOptions?.input).toEqual([
      "virtual:resumable/client-entry",
      "custom-client-entry.ts"
    ]);

    generateBundle?.call(
      {
        environment: { config: { consumer: "client" } }
      },
      {},
      {
        "build/q-client.js": {
          type: "chunk",
          fileName: "build/q-client.js",
          facadeModuleId:
            "/project/node_modules/@resumable.dev/core/lib/entries/client-entry.ts",
          moduleIds: []
        }
      }
    );

    expect(load?.("virtual:resumable/client-entry-path")).toBe(
      'export const clientEntryPath = "/app/build/q-client.js";'
    );
  });

  it("registers page route preload graph entries with Qwik", () => {
    const plugins = flattenPlugins([resumable()]);
    const vitePlugin = plugins.find((plugin) => plugin.name === "resumable:vite");
    const registerPreloadGraphEntries = vi.fn();

    (vitePlugin?.configResolved as ((config: unknown) => void) | undefined)?.({
      base: "/",
      plugins: [
        {
          name: "vite-plugin-qwik",
          api: { registerPreloadGraphEntries }
        }
      ]
    });

    expect(registerPreloadGraphEntries).toHaveBeenCalledTimes(1);

    const addRoutePreloadGraph = registerPreloadGraphEntries.mock.calls[0]?.[0];
    const bundlesForOrigins = vi.fn(() => ["q-route-entry.js"]);
    const graph = addRoutePreloadGraph({
      bundlesForOrigins,
      manifest: {
        bundles: {
          "q-route-entry.js": {
            size: 100,
            total: 100,
            origins: ["pages/links.tsx"]
          }
        },
        mapping: {},
        symbols: {},
        manifestHash: "",
        version: "1"
      }
    });

    expect(bundlesForOrigins).toHaveBeenCalledWith(["pages/links.tsx"]);
    expect(graph).toEqual({
      "/links": { dynamicImports: ["q-route-entry.js"] }
    });
  });

  it("falls back to Vite's virtual client entry URL before a client build", () => {
    const plugins = flattenPlugins([resumable()]);
    const vitePlugin = plugins.find((plugin) => plugin.name === "resumable:vite");
    const routesPlugin = plugins.find((plugin) => plugin.name === "resumable:routes");
    const load = hookHandler(routesPlugin?.load) as
      | ((id: string) => string | undefined)
      | undefined;

    (vitePlugin?.configResolved as ((config: { base: string }) => void) | undefined)?.({
      base: "/"
    });

    expect(load?.("virtual:resumable/client-entry-path")).toBe(
      'export const clientEntryPath = "/@id/virtual:resumable/client-entry";'
    );
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
    const source = await readFile(
      new URL("../../src/vite/vite.ts", import.meta.url),
      "utf-8"
    );

    expect(source).toContain("sortUserPlugins");
    expect(source).not.toContain("function flattenPlugins");
    expect(source).not.toContain("...nitroPlugins");
  });

  it("generates route type files through the Vite host filesystem", async () => {
    const source = await readFile(
      new URL("../../src/vite/route-typegen.ts", import.meta.url),
      "utf-8"
    );

    expect(source).toContain("this.fs");
    expect(source).toContain("createRouteTypesDeclaration");
    expect(source).toContain("routeTypesEnvDeclaration");
    expect(source).not.toContain('"node:');
    expect(source).not.toContain("'node:");
  });

  it("uses Vite environment hooks instead of name-specific environment input helpers", async () => {
    const source = await readFile(
      new URL("../../src/vite/vite.ts", import.meta.url),
      "utf-8"
    );

    expect(source).toContain("configEnvironment");
    expect(source).toContain(".consumer");
    expect(source).toContain("rolldownOptions");
    expect(source).not.toContain("environments:");
    expect(source).not.toContain("ssr: {}");
    expect(source).not.toContain("rollupOptions");
    expect(source).not.toContain("createEnvironmentConfig");
    expect(source).not.toContain("createEnvironmentWithInput");
    expect(source).not.toContain("environments?.client");
    expect(source).not.toContain("environments?.ssr");
  });
});
