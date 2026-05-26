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

export interface AppLocals {}

export interface HttpResponse {
  readonly headers: Headers;
  status?: number;
  statusText?: string;
}

export interface HttpContext<Locals extends object = AppLocals> {
  readonly locals: Locals;
  readonly request: Request;
  readonly response: HttpResponse;
  readonly url: URL;
}

export interface EndpointHttpContext<
  Params extends object = Readonly<Record<string, string>>,
  Locals extends object = AppLocals
> extends HttpContext<Locals> {
  readonly params: Readonly<Params>;
}

export interface MiddlewareHttpContext<Locals extends object = AppLocals>
  extends HttpContext<Locals> {}

export function __resumableCreateHttpContext<
  Params extends object = Readonly<Record<string, string>>,
  Locals extends object = AppLocals
>(event: H3Event): EndpointHttpContext<Params, Locals> {
  return {
    locals: event.context as Locals,
    params: (event.context.params ?? {}) as Params,
    request: event.req as unknown as Request,
    response: event.res,
    url: event.url
  };
}

export function Html(props: PropsOf<"html">): JSXOutput {
  return props.children as JSXOutput;
}
