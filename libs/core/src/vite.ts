import { nitro } from "nitro/vite";
import { sortUserPlugins, type Plugin, type PluginOption, type UserConfig } from "vite";

const ROUTE_DISCOVERY_ID = "virtual:resumable/routes";
const CLIENT_ENTRY_ID = "virtual:resumable/client-entry";
const SERVER_ENTRY_ID = "virtual:resumable/server-entry";
const RESOLVED_ROUTE_DISCOVERY_ID = `\0${ROUTE_DISCOVERY_ID}`;
const RESOLVED_CLIENT_ENTRY_ID = `\0${CLIENT_ENTRY_ID}`;
const RESOLVED_SERVER_ENTRY_ID = `\0${SERVER_ENTRY_ID}`;

export interface ResumableOptions {}

export function resumable(_options: ResumableOptions = {}): PluginOption[] {
  const nitroPlugins = nitro();

  return [configPlugin(nitroPlugins), virtualModulesPlugin(), nitroPlugins];
}

function configPlugin(nitroPluginsFromResumable: readonly Plugin[]): Plugin {
  return {
    name: "resumable:vite",
    enforce: "pre",
    config(config: UserConfig) {
      throwIfUserAddedNitro(config.plugins, nitroPluginsFromResumable);

      return {
        environments: {
          ssr: {},
          ...config.environments
        },
        nitro: createNitroConfig(config.nitro)
      };
    },
    configEnvironment(_name, config) {
      const defaultInput =
        config.consumer === "client" ? CLIENT_ENTRY_ID : SERVER_ENTRY_ID;

      return {
        build: {
          ...config.build,
          rolldownOptions: {
            ...config.build?.rolldownOptions,
            input: config.build?.rolldownOptions?.input ?? defaultInput
          }
        }
      };
    }
  };
}

function virtualModulesPlugin(): Plugin {
  return {
    name: "resumable:routes",
    resolveId(id) {
      if (id === ROUTE_DISCOVERY_ID) {
        return RESOLVED_ROUTE_DISCOVERY_ID;
      }

      if (id === CLIENT_ENTRY_ID) {
        return RESOLVED_CLIENT_ENTRY_ID;
      }

      if (id === SERVER_ENTRY_ID) {
        return RESOLVED_SERVER_ENTRY_ID;
      }
    },
    load(id) {
      if (id === RESOLVED_ROUTE_DISCOVERY_ID) {
        return ROUTE_DISCOVERY_MODULE_CODE;
      }

      if (id === RESOLVED_CLIENT_ENTRY_ID) {
        return CLIENT_ENTRY_CODE;
      }

      if (id === RESOLVED_SERVER_ENTRY_ID) {
        return SERVER_ENTRY_CODE;
      }
    }
  };
}

const ROUTE_DISCOVERY_MODULE_CODE = `import { normalizeRouteFileId } from "@resumable.dev/core";

const discoveredPageModuleLoaders = import.meta.glob("/pages/**/*.tsx");
export const pageModuleLoaders = Object.fromEntries(
  Object.entries(discoveredPageModuleLoaders).map(([file, loader]) => [
    normalizeRouteFileId(file),
    loader
  ])
);
export const routeFileIds = Object.keys(pageModuleLoaders);
`;

const CLIENT_ENTRY_CODE = `export const pageModules = import.meta.glob("/pages/**/*.tsx");
`;

const SERVER_ENTRY_CODE = `import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime";
import { renderToString } from "@qwik.dev/core/server";
import { buildRouteManifestFromFileIds, matchRouteManifest } from "@resumable.dev/core";
import { pageModuleLoaders, routeFileIds } from "virtual:resumable/routes";

const manifest = buildRouteManifestFromFileIds(routeFileIds);

export default { fetch };

export async function fetch(request) {
  const url = new URL(request.url);
  const match = matchRouteManifest(url.pathname, manifest);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const route = match.route;
  const loadPageModule = pageModuleLoaders[route.file];
  if (!loadPageModule) {
    return new Response(\`Page module not found: \${route.file}\`, { status: 500 });
  }

  const pageModule = await loadPageModule();
  const Page = pageModule.default;
  if (!Page) {
    return new Response(\`Page module must default export a Qwik component: \${route.file}\`, {
      status: 500
    });
  }

  const result = await renderToString(
    jsxs(Fragment, {
      children: [
        jsx("head", {}),
        jsx("body", {
          children: jsx(Page, {
            params: match.params,
            url: {
              href: url.href,
              pathname: url.pathname,
              search: url.search
            },
            status: 200
          })
        })
      ]
    }),
    {
      base: import.meta.env.DEV ? "/" : undefined,
      containerAttributes: { lang: "en" }
    }
  );

  return new Response(result.html, {
    headers: { "content-type": "text/html;charset=utf-8" }
  });
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
