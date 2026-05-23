import { nitro } from "nitro/vite";
import { sortUserPlugins, type Plugin, type PluginOption, type UserConfig } from "vite";

const ROUTES_MODULE_ID = "virtual:resumable/routes";
const RESOLVED_ROUTES_MODULE_ID = `\0${ROUTES_MODULE_ID}`;

export interface ResumableOptions {}

export function resumable(_options: ResumableOptions = {}): PluginOption[] {
  const nitroPlugins = nitro();

  return [configPlugin(nitroPlugins), routesPlugin(), nitroPlugins];
}

function configPlugin(nitroPluginsFromResumable: readonly Plugin[]): Plugin {
  return {
    name: "resumable:vite",
    enforce: "pre",
    config(config: UserConfig) {
      throwIfUserAddedNitro(config.plugins, nitroPluginsFromResumable);

      return {
        nitro: createNitroConfig(config.nitro)
      };
    }
  };
}

function routesPlugin(): Plugin {
  return {
    name: "resumable:routes",
    resolveId(id) {
      if (id === ROUTES_MODULE_ID) {
        return RESOLVED_ROUTES_MODULE_ID;
      }
    },
    load(id) {
      if (id !== RESOLVED_ROUTES_MODULE_ID) {
        return;
      }

      return ROUTES_MODULE_CODE;
    }
  };
}

const ROUTES_MODULE_CODE = `import { normalize } from "pathe";
import { withoutLeadingSlash } from "ufo";

const discoveredPageModuleLoaders = import.meta.glob("/pages/**/*.tsx");
export const pageModuleLoaders = Object.fromEntries(
  Object.entries(discoveredPageModuleLoaders).map(([file, loader]) => [
    normalizeRouteFileId(file),
    loader
  ])
);
export const routeFileIds = Object.keys(pageModuleLoaders);

function normalizeRouteFileId(file) {
  return withoutLeadingSlash(normalize(file));
}`;

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
      (plugin) => plugin.name.startsWith("nitro:") && !resumableNitroPluginSet.has(plugin)
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
