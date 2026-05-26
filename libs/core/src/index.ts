import type { JSXOutput, PropsOf } from "@qwik.dev/core";
import type { H3Event } from "nitro";

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
export {
  normalizeRequestFileId,
  parseRequestFile
} from "./request-files.ts";
export type {
  ApiRequestFileCache,
  ApiRequestFileMethod,
  ApiRequestFileRoute,
  RequestFileDefaultExport,
  RequestFileDiagnostic,
  RequestFileDiagnosticCode,
  RequestFileParam,
  RequestFileParseResult
} from "./request-files.ts";

export interface PageProps<Params extends object = Readonly<Record<string, string>>> {
  readonly params: Readonly<Params>;
  readonly url: {
    readonly href: string;
    readonly pathname: string;
    readonly search: string;
  };
  readonly status: number;
}

export interface AppContext {}

type RequestEventContext<Context extends object> = H3Event["context"] & Context;

type EndpointEventContext<
  Params extends object,
  Context extends object
> = RequestEventContext<Context> & {
  readonly params: Readonly<Params>;
};

export interface RequestEvent<Context extends object = AppContext> extends H3Event {
  readonly context: RequestEventContext<Context>;
}

export interface EndpointEvent<
  Params extends object = Readonly<Record<string, string>>,
  Context extends object = AppContext
> extends RequestEvent<Context> {
  readonly context: EndpointEventContext<Params, Context>;
}

export interface MiddlewareEvent<Context extends object = AppContext>
  extends RequestEvent<Context> {}

export function Html(props: PropsOf<"html">): JSXOutput {
  return props.children as JSXOutput;
}
