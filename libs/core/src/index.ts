export {
  buildRouteManifestFromFileIds,
  matchRouteManifest,
  normalizeRequestPathname,
  normalizeRouteFileId
} from "./route-manifest.ts";
export type {
  RouteManifest,
  RouteManifestMatch,
  RouteManifestParam,
  RouteManifestRoute,
  RouteManifestStatusPages
} from "./route-manifest.ts";
export type { ResumableOptions } from "./vite.ts";
export { resumable } from "./vite.ts";

export interface PageProps {
  readonly params: Readonly<Record<string, string>>;
  readonly url: {
    readonly href: string;
    readonly pathname: string;
    readonly search: string;
  };
  readonly status: number;
}
