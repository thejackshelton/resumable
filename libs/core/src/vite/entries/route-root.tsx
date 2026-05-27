import {
  $,
  component$,
  noSerialize,
  useOnDocument,
  useSignal,
  type JSXOutput,
  type NoSerialize
} from "@qwik.dev/core";
import { Fragment, jsx, jsxs } from "@qwik.dev/core/jsx-runtime";
import {
  RESUMABLE_ROUTE_EVENT,
  __resumableRoutePageProps,
  type __ResumableRouteDocumentModule,
  type __ResumableRoutePageModule,
  type __ResumableRouteState,
  type __ResumableRouteUpdate
} from "@resumable.dev/core";

interface RouteRootState {
  readonly clientEntryPath?: string;
  readonly document?:
    | __ResumableRouteDocumentModule
    | NoSerialize<__ResumableRouteDocumentModule>;
  readonly page: __ResumableRoutePageModule | NoSerialize<__ResumableRoutePageModule>;
  readonly route: __ResumableRouteState;
}

export const ResumableRouteRoot = component$((props: RouteRootState) => {
  const route = useSignal<RouteRootState>();
  const onRoute = $((event: Event) => {
    const detail = (event as CustomEvent<__ResumableRouteUpdate>).detail;
    route.value = {
      document: detail.document && noSerialize(detail.document),
      page: noSerialize(detail.page),
      route: detail.route
    };
  });
  useOnDocument(RESUMABLE_ROUTE_EVENT, onRoute);

  const current = route.value ?? props;
  const pageProps = __resumableRoutePageProps(current.route);
  const Page = current.page?.default;
  const page = Page
    ? (jsx(Page, pageProps as never, current.route.url) as JSXOutput)
    : undefined;
  const bodyContent = route.value
    ? page
    : renderBodyContent(page, props.clientEntryPath);
  const Document = current.document?.default;

  return Document
    ? (jsx(Document, { ...pageProps, children: bodyContent } as never) as JSXOutput)
    : renderDefaultDocument(bodyContent);
});

function renderBodyContent(page: JSXOutput | undefined, clientEntryPath: string | undefined) {
  return clientEntryPath
    ? (jsxs(Fragment, {
        children: [
          page,
          jsx("script", { type: "module", src: clientEntryPath })
        ]
      }) as JSXOutput)
    : page;
}

function renderDefaultDocument(page: JSXOutput | undefined) {
  return jsxs(Fragment, {
    children: [
      jsxs("head", {
        children: [
          jsx("meta", { charSet: "utf-8" }),
          jsx("meta", {
            name: "viewport",
            content: "width=device-width, initial-scale=1"
          })
        ]
      }),
      jsx("body", { children: page })
    ]
  }) as JSXOutput;
}
