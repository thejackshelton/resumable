import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime";
import { renderToString } from "@qwik.dev/core/server";
import { createServerEntry } from "@resumable.dev/core/vite/runtime/create-server-entry";
import { pageModuleLoaders, routeFileIds } from "virtual:resumable/routes";

const appModuleLoaders = import.meta.glob("/app.tsx");
const entry = createServerEntry({
  appModuleLoader: appModuleLoaders["/app.tsx"],
  isDev: import.meta.env.DEV,
  pageModuleLoaders,
  qwik: { Fragment, jsx, jsxs, renderToString },
  routeFileIds
});

export const fetch = entry.fetch;
export default entry;
