import type { JSXOutput, PropsOf } from "@qwik.dev/core";

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

export interface PageProps<Params extends object = Readonly<Record<string, string>>> {
  readonly params: Readonly<Params>;
  readonly url: {
    readonly href: string;
    readonly pathname: string;
    readonly search: string;
  };
  readonly status: number;
}

export function Html(props: PropsOf<"html">): JSXOutput {
  return props.children as JSXOutput;
}
