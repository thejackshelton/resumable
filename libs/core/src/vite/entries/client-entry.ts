import { __resumableStartSpaNavigation } from "@resumable.dev/core";
import { createRouteDiscovery } from "@resumable.dev/core/vite/runtime/create-route-discovery";
export { ResumableRouteRoot } from "./route-root";

export const documentModules = import.meta.glob(["/document.tsx", "/document.jsx"]);
const routeDiscovery = createRouteDiscovery(import.meta.glob("/pages/**/*.tsx"));

export const pageModules = routeDiscovery.pageModuleLoaders;
export const routeFileIds = routeDiscovery.routeFileIds;

export const __resumableSpaNavigation = __resumableStartSpaNavigation({
  documentModuleLoader:
    documentModules["/document.tsx"] ?? documentModules["/document.jsx"],
  pageModuleLoaders: pageModules,
  routeFileIds
});
