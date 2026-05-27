import { HTTPError } from "nitro";
import type { FunctionComponent, JSXOutput, NoSerialize } from "@qwik.dev/core";
import type * as QwikJsxRuntime from "@qwik.dev/core/jsx-runtime";
import type * as QwikServer from "@qwik.dev/core/server";
import type { PageProps } from "../../index.ts";
import {
  buildRouteManifestFromFileIds,
  matchRouteManifest
} from "../../route-manifest.ts";
import type {
  RouteDocumentModule,
  RoutePageModule,
  RouteState
} from "../../route-state.ts";

export interface ServerEntryOptions {
  readonly clientEntryPath?: string;
  readonly documentModuleLoader: (() => Promise<unknown>) | undefined;
  readonly pageModuleLoaders: Record<string, () => Promise<unknown>>;
  readonly qwik: QwikRenderRuntime;
  readonly qwikAssetBase?: string;
  readonly routeRoot?: FunctionComponent<RouteRootProps>;
  readonly routeFileIds: readonly string[];
}

interface QwikRenderRuntime {
  readonly Fragment: typeof QwikJsxRuntime.Fragment;
  readonly jsx: typeof QwikJsxRuntime.jsx;
  readonly jsxs: typeof QwikJsxRuntime.jsxs;
  readonly noSerialize?: typeof import("@qwik.dev/core").noSerialize;
  readonly renderToString: typeof QwikServer.renderToString;
}

interface DocumentModule {
  readonly default?: FunctionComponent<DocumentComponentProps>;
  readonly __resumableHtmlAttributes?: (
    props: PageComponentProps
  ) => Record<string, unknown>;
}

interface RouteRootProps {
  readonly document?: RouteDocumentModule | NoSerialize<RouteDocumentModule>;
  readonly page: RoutePageModule | NoSerialize<RoutePageModule>;
  readonly route: RouteState;
}

type PageComponentProps = PageProps & Record<string, unknown>;
type DocumentComponentProps = PageComponentProps & { children: unknown };

export function createServerEntry(options: ServerEntryOptions) {
  const manifest = buildRouteManifestFromFileIds(options.routeFileIds);
  const { Fragment, jsx, jsxs, noSerialize, renderToString } = options.qwik;

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (isNitroApiPathname(url.pathname)) {
      throw HTTPError.status(404);
    }

    const match = matchRouteManifest(url.pathname, manifest);
    if (!match) {
      return renderStatusPage(url, manifest.statusPages.notFound, 404, "Not found");
    }

    try {
      return await renderPage(url, match.route.file, match.params, 200);
    } catch {
      return renderStatusPage(
        url,
        manifest.statusPages.error,
        500,
        "Internal Server Error"
      );
    }
  }

  async function renderStatusPage(
    url: URL,
    file: string | undefined,
    status: number,
    fallbackText: string
  ) {
    if (!file) {
      return new Response(fallbackText, { status });
    }

    return renderPage(url, file, {}, status);
  }

  async function renderPage(
    url: URL,
    file: string,
    params: Readonly<Record<string, string>>,
    status: number
  ) {
    const loadPageModule = options.pageModuleLoaders[file];
    if (!loadPageModule) {
      return new Response(`Page module not found: ${file}`, { status: 500 });
    }

    const pageModule = (await loadPageModule()) as RoutePageModule;
    const Page = pageModule.default;
    if (!Page) {
      return new Response(`Page module must default export a Qwik component: ${file}`, {
        status: 500
      });
    }

    const documentModule = options.documentModuleLoader
      ? ((await options.documentModuleLoader()) as DocumentModule)
      : undefined;
    const Document = documentModule?.default;
    if (documentModule && !Document) {
      throw new Error(
        "document.tsx or document.jsx must default export a Qwik component."
      );
    }

    const pageProps: PageComponentProps = {
      params,
      url: {
        href: url.href,
        pathname: url.pathname,
        search: url.search
      },
      status
    };
    const route: RouteState = {
      file,
      params,
      status,
      url: url.href
    };
    const root =
      options.routeRoot && noSerialize
        ? jsx(options.routeRoot, {
            document: documentModule && noSerialize(documentModule),
            page: noSerialize(pageModule),
            route
          })
        : renderPageRoot(Document, Page, pageProps);
    const result = await renderToString(root, {
      base: options.qwikAssetBase,
      containerAttributes: htmlAttributes(documentModule, pageProps)
    });
    const html = injectClientEntry(result.html, options.clientEntryPath);

    return new Response(html, {
      status,
      headers: { "content-type": "text/html;charset=utf-8" }
    });
  }

  function renderPageRoot(
    Document: FunctionComponent<DocumentComponentProps> | undefined,
    Page: FunctionComponent<PageComponentProps>,
    pageProps: PageComponentProps
  ) {
    const page = jsx(Page, pageProps);
    return Document
      ? (jsx(Document, { ...pageProps, children: page }) as JSXOutput)
      : renderDefaultDocument(page);
  }

  function renderDefaultDocument(page: JSXOutput) {
    return jsxs(Fragment, {
      children: [renderDefaultHead(), jsx("body", { children: page })]
    }) as JSXOutput;
  }

  function renderDefaultHead() {
    return jsxs("head", {
      children: [
        jsx("meta", { charSet: "utf-8" }),
        jsx("meta", {
          name: "viewport",
          content: "width=device-width, initial-scale=1"
        })
      ]
    });
  }

  return { fetch };
}

function htmlAttributes(
  documentModule: DocumentModule | undefined,
  pageProps: PageComponentProps
) {
  const attributes = documentModule?.__resumableHtmlAttributes?.(pageProps) ?? {
    lang: "en"
  };
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) {
      continue;
    }

    normalized[name] = String(value);
  }

  return normalized;
}

function isNitroApiPathname(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function injectClientEntry(html: string, src: string | undefined) {
  if (!src) {
    return html;
  }

  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    return html;
  }

  const script = `<script type="module" src="${escapeHtmlAttribute(src)}"></script>`;
  return `${html.slice(0, headEnd)}${script}${html.slice(headEnd)}`;
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
