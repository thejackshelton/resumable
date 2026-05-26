import {
  component$,
  jsx,
  Slot,
  type Component,
  type JSXOutput,
  type PropsOf
} from "@qwik.dev/core";
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

export interface ResumableGeneratedRoutes {}

export interface LinkNavigationProps {
  readonly prefetch?: boolean | "intent" | "viewport";
  readonly replace?: boolean;
  readonly scroll?: boolean;
  readonly reload?: boolean;
}

export type LinkProps = ResumableGeneratedRoutes extends { readonly link: infer Props }
  ? Props
  : PropsOf<"a"> & LinkNavigationProps;

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

export const Link: Component<LinkProps> = component$((props) => {
  const {
    children: _children,
    params: _params,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    reload: _reload,
    ...anchorProps
  } = props as LinkProps &
    LinkNavigationProps & {
      readonly params?: unknown;
    };

  return jsx("a", {
    ...(anchorProps as Record<string, unknown>),
    children: jsx(Slot, {})
  });
});
