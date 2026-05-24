import { HTTPError } from "nitro";
import type { FunctionComponent, JSXOutput } from "@qwik.dev/core";
import type * as QwikJsxRuntime from "@qwik.dev/core/jsx-runtime";
import type * as QwikServer from "@qwik.dev/core/server";
import type { PageProps } from "../../index.ts";
import {
  buildRouteManifestFromFileIds,
  matchRouteManifest
} from "../../route-manifest.ts";

export interface ServerEntryOptions {
  readonly appModuleLoader: (() => Promise<unknown>) | undefined;
  readonly isDev: boolean;
  readonly pageModuleLoaders: Record<string, () => Promise<unknown>>;
  readonly qwik: QwikRenderRuntime;
  readonly routeFileIds: readonly string[];
}

interface QwikRenderRuntime {
  readonly Fragment: typeof QwikJsxRuntime.Fragment;
  readonly jsx: typeof QwikJsxRuntime.jsx;
  readonly jsxs: typeof QwikJsxRuntime.jsxs;
  readonly renderToString: typeof QwikServer.renderToString;
}

interface PageModule {
  readonly default?: FunctionComponent<PageComponentProps>;
}

interface AppModule {
  readonly default?: FunctionComponent<AppComponentProps>;
  readonly __resumableHtmlAttributes?: (
    props: PageComponentProps
  ) => Record<string, unknown>;
}

type PageComponentProps = PageProps & Record<string, unknown>;
type AppComponentProps = PageComponentProps & { children: unknown };

export function createServerEntry(options: ServerEntryOptions) {
  const manifest = buildRouteManifestFromFileIds(options.routeFileIds);
  const { Fragment, jsx, jsxs, renderToString } = options.qwik;

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

    const pageModule = (await loadPageModule()) as PageModule;
    const Page = pageModule.default;
    if (!Page) {
      return new Response(`Page module must default export a Qwik component: ${file}`, {
        status: 500
      });
    }

    const appModule = options.appModuleLoader
      ? ((await options.appModuleLoader()) as AppModule)
      : undefined;
    const App = appModule?.default;
    if (appModule && !App) {
      throw new Error("app.tsx or app.jsx must default export a Qwik component.");
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
    const page = jsx(Page, pageProps);
    const root = App ? renderAppShell(App, pageProps, page) : renderDefaultDocument(page);
    const result = await renderToString(root, {
      base: options.isDev ? "/" : undefined,
      containerAttributes: htmlAttributes(appModule, pageProps)
    });

    return new Response(result.html, {
      status,
      headers: { "content-type": "text/html;charset=utf-8" }
    });
  }

  function renderAppShell(
    App: FunctionComponent<AppComponentProps>,
    pageProps: PageComponentProps,
    page: JSXOutput
  ) {
    return jsx(App, { ...pageProps, children: page }) as JSXOutput;
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

function htmlAttributes(appModule: AppModule | undefined, pageProps: PageComponentProps) {
  const attributes = appModule?.__resumableHtmlAttributes?.(pageProps) ?? {
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
