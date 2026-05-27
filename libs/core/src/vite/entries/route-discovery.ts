import { createRouteDiscovery } from "@resumable.dev/core/vite/runtime/create-route-discovery";

const routeDiscovery = createRouteDiscovery(
  import.meta.glob(["/pages/**/*.tsx", "/pages/**/*.mdx"])
);

export const pageModuleLoaders = routeDiscovery.pageModuleLoaders;
export const routeFileIds = routeDiscovery.routeFileIds;
