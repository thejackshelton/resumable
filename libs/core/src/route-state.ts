import type { FunctionComponent } from "@qwik.dev/core";
import type { PageProps } from "./index.ts";

export const RESUMABLE_ROUTE_EVENT = "resumablenavigate";

export interface RouteState {
  readonly file: string;
  readonly params: Readonly<Record<string, string>>;
  readonly status: number;
  readonly url: string;
}

export interface RoutePageModule {
  readonly default?: FunctionComponent<PageProps & Record<string, unknown>>;
}

export interface RouteDocumentModule {
  readonly default?: FunctionComponent<
    PageProps & Record<string, unknown> & { readonly children: unknown }
  >;
}

export interface RouteUpdate {
  readonly document?: RouteDocumentModule;
  readonly page: RoutePageModule;
  readonly route: RouteState;
}

export function routePageProps(route: RouteState): PageProps {
  const url = new URL(route.url);
  return {
    params: route.params,
    status: route.status,
    url: {
      href: url.href,
      pathname: url.pathname,
      search: url.search
    }
  };
}

export function dispatchRouteUpdate(document: Document, update: RouteUpdate) {
  document.dispatchEvent(
    new CustomEvent<RouteUpdate>(RESUMABLE_ROUTE_EVENT, {
      detail: update
    })
  );
}
