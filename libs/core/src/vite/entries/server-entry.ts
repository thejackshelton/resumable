import { noSerialize } from "@qwik.dev/core";
import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime";
import { renderToString } from "@qwik.dev/core/server";
import { createServerEntry } from "@resumable.dev/core/vite/runtime/create-server-entry";
import { clientEntryPath } from "virtual:resumable/client-entry-path";
import { pageModuleLoaders, routeFileIds } from "virtual:resumable/routes";
import { joinURL } from "ufo";
import { ResumableRouteRoot } from "./route-root";

const documentModuleLoaders = import.meta.glob(["/document.tsx", "/document.jsx"]);
const entry = createServerEntry({
  documentModuleLoader:
    documentModuleLoaders["/document.tsx"] ?? documentModuleLoaders["/document.jsx"],
  clientEntryPath,
  pageModuleLoaders,
  qwik: { Fragment, jsx, jsxs, noSerialize, renderToString },
  qwikAssetBase: joinURL(import.meta.env.BASE_URL, "build"),
  routeRoot: ResumableRouteRoot,
  routeFileIds
});

export const fetch = entry.fetch;
export default entry;
