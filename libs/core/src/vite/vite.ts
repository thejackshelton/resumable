import { nitro } from "nitro/vite";
import { dirname, join } from "pathe";
import {
  mergeConfig,
  sortUserPlugins,
  type EnvironmentOptions,
  type Plugin,
  type PluginOption,
  type UserConfig
} from "vite";
import { decodePath, parseURL } from "ufo";
import { anchorTransformPlugin } from "./anchor-transform.ts";
import { htmlTransformPlugin } from "./html-transform.ts";
import { routeTypegenPlugin } from "./route-typegen.ts";

const QWIK_CORE_PACKAGE_ID = "@qwik.dev/core";
const QWIK_CORE_IMPORT_RE = /^@qwik\.dev\/core(?:\/.*)?$/;
const ROUTE_DISCOVERY_ID = "virtual:resumable/routes";
const CLIENT_ENTRY_ID = "virtual:resumable/client-entry";
const SERVER_ENTRY_ID = "virtual:resumable/server-entry";
const ROUTE_HREF_ID = "virtual:resumable/route-href";
const PUBLIC_VIRTUAL_MODULE_ID_RE =
  /^virtual:resumable\/(?:routes|client-entry|server-entry|route-href)$/;
const VITE_PLUGIN_FILE = decodePath(parseURL(import.meta.url).pathname);
const VIRTUAL_ENTRY_DIR = VITE_PLUGIN_FILE.endsWith(".ts")
  ? join(dirname(VITE_PLUGIN_FILE), "entries")
  : join(dirname(dirname(VITE_PLUGIN_FILE)), "entries");

const virtualEntryFiles = {
  [ROUTE_DISCOVERY_ID]: "route-discovery.ts",
  [CLIENT_ENTRY_ID]: "client-entry.ts",
  [SERVER_ENTRY_ID]: "server-entry.ts",
  [ROUTE_HREF_ID]: "route-href.ts"
} as const;

export interface ResumableOptions {}

export function resumable(_options: ResumableOptions = {}): PluginOption[] {
  const nitroPlugins = nitro();

  return [
    configPlugin(nitroPlugins),
    routeTypegenPlugin(),
    anchorTransformPlugin(),
    htmlTransformPlugin(),
    virtualModulesPlugin(),
    nitroPlugins
  ];
}

function configPlugin(nitroPluginsFromResumable: readonly Plugin[]): Plugin {
  return {
    name: "resumable:vite",
    enforce: "pre",
    config(config: UserConfig) {
      throwIfUserAddedNitro(config.plugins, nitroPluginsFromResumable);
      config.environments ??= {};
      config.environments.ssr ??= {};

      return {
        nitro: createNitroConfig(config.nitro)
      };
    },
    configEnvironment(_name, config) {
      const defaultInput =
        config.consumer === "client" ? CLIENT_ENTRY_ID : SERVER_ENTRY_ID;

      configureQwikRuntimeResolution(config);

      config.build ??= {};
      config.build.rolldownOptions ??= {};
      config.build.rolldownOptions.input ??= defaultInput;
    }
  };
}

function configureQwikRuntimeResolution(config: EnvironmentOptions) {
  // TODO: Re-check after QwikDev/qwik#8609 lands. If same-version shared
  // singletons make duplicate Qwik imports safe, remove this Vite bridge and
  // keep the fixture test as proof.
  const qwikConfig: EnvironmentOptions = {
    resolve: {
      dedupe: [QWIK_CORE_PACKAGE_ID]
    },
    optimizeDeps: {
      exclude: [QWIK_CORE_PACKAGE_ID]
    }
  };

  if (config.consumer === "server" && config.resolve?.noExternal !== true) {
    qwikConfig.resolve = {
      ...qwikConfig.resolve,
      noExternal: [QWIK_CORE_IMPORT_RE]
    };
  }

  Object.assign(config, mergeConfig(config, qwikConfig) as EnvironmentOptions);
}

function virtualModulesPlugin(): Plugin {
  return {
    name: "resumable:routes",
    resolveId: {
      filter: {
        id: PUBLIC_VIRTUAL_MODULE_ID_RE
      },
      handler(id) {
        const entryFile = virtualEntryFiles[id as keyof typeof virtualEntryFiles];
        if (!entryFile) {
          return;
        }

        return join(VIRTUAL_ENTRY_DIR, entryFile);
      }
    }
  };
}

function throwIfUserAddedNitro(
  plugins: UserConfig["plugins"] | undefined,
  nitroPluginsFromResumable: readonly Plugin[]
) {
  const resumableNitroPluginSet = new Set(nitroPluginsFromResumable);
  const duplicateNitroPlugin = sortUserPlugins(
    plugins as Parameters<typeof sortUserPlugins>[0]
  )
    .flat()
    .filter(Boolean)
    .find(
      (plugin) =>
        typeof plugin.name === "string" &&
        plugin.name.startsWith("nitro:") &&
        !resumableNitroPluginSet.has(plugin)
    );

  if (duplicateNitroPlugin) {
    throw new Error(
      "Resumable wires Nitro internally. Remove nitro() from vite.config.ts and keep plugins: [qwik(), resumable()]."
    );
  }
}

function createNitroConfig(
  nitroConfig: UserConfig["nitro"] | undefined
): NonNullable<UserConfig["nitro"]> {
  const scanDirs = Array.isArray(nitroConfig?.scanDirs)
    ? nitroConfig.scanDirs.filter((dir): dir is string => typeof dir === "string")
    : [];

  return {
    ...nitroConfig,
    apiDir: nitroConfig?.apiDir ?? "api",
    routesDir: nitroConfig?.routesDir ?? ".resumable/nitro-routes",
    scanDirs: [...new Set([".", ...scanDirs])]
  } as NonNullable<UserConfig["nitro"]>;
}
