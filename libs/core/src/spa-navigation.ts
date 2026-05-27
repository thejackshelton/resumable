import {
  buildRouteManifestFromFileIds,
  matchRouteManifest,
  type RouteManifest
} from "./route-manifest.ts";
import { dispatchRouteUpdate, type RouteDocumentModule } from "./route-state.ts";
// @ts-expect-error Qwik exposes the browser preloader without public types.
import { p as preload } from "@qwik.dev/core/preloader";

const STARTED = "__resumableSpaNavigationStarted";
const LINK_ATTRIBUTE = "data-resumable-link";
const REPLACE_ATTRIBUTE = "data-resumable-replace";
const SCROLL_ATTRIBUTE = "data-resumable-scroll";
const LINK_INFO = "__resumableLink";

export type ResumableNavigationRuntime = Pick<
  Navigation,
  "addEventListener" | "navigate"
>;

export interface ResumableNavigationWindow {
  readonly document: Document;
  readonly location: Location;
  navigation?: ResumableNavigationRuntime;
  addEventListener(
    type: "click",
    listener: (event: MouseEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
}

export interface ResumableNavigationPolyfillModule {
  applyPolyfill(options: {
    readonly interceptEvents: boolean;
    readonly window: ResumableNavigationWindow;
  }): unknown;
}

export interface StartSpaNavigationOptions {
  readonly documentModuleLoader?: () => Promise<unknown>;
  readonly loadPolyfill?: () => Promise<ResumableNavigationPolyfillModule>;
  readonly pageModuleLoaders: Record<string, () => Promise<unknown>>;
  readonly routeFileIds: readonly string[];
  readonly window?: ResumableNavigationWindow;
}

interface NavigationContext {
  readonly documentModuleLoader?: () => Promise<unknown>;
  readonly manifest: RouteManifest;
  readonly pageModuleLoaders: Record<string, () => Promise<unknown>>;
  readonly window: ResumableNavigationWindow;
}

export async function __resumableStartSpaNavigation(options: StartSpaNavigationOptions) {
  const runtimeWindow = options.window ?? browserWindow();
  const state = runtimeWindow as unknown as Record<string, unknown>;
  if (state[STARTED]) {
    return;
  }
  state[STARTED] = true;

  const context: NavigationContext = {
    documentModuleLoader: options.documentModuleLoader,
    manifest: buildRouteManifestFromFileIds(options.routeFileIds),
    pageModuleLoaders: options.pageModuleLoaders,
    window: runtimeWindow
  };
  const navigation = await ensureNavigationRuntime(runtimeWindow, options.loadPolyfill);

  runtimeWindow.addEventListener(
    "click",
    (event) => handleLinkClick(event, context, navigation),
    true
  );
  navigation.addEventListener("navigate", (event) => {
    handleNavigateEvent(event, context);
  });
}

export async function ensureNavigationRuntime(
  runtimeWindow: ResumableNavigationWindow = browserWindow(),
  loadPolyfill?: () => Promise<ResumableNavigationPolyfillModule>
) {
  if (!runtimeWindow.navigation) {
    const { applyPolyfill } = (await (loadPolyfill?.() ??
      import("@virtualstate/navigation"))) as ResumableNavigationPolyfillModule;
    runtimeWindow.navigation = applyPolyfill({
      interceptEvents: false,
      window: runtimeWindow
    }) as ResumableNavigationRuntime;
  }

  return runtimeWindow.navigation;
}

export function handleNavigateEvent(event: NavigateEvent, context: NavigationContext) {
  const url = routeUrl(event, context);
  if (!url) {
    return false;
  }

  event.intercept({
    focusReset: "after-transition",
    scroll: navigationScroll(event),
    handler: () => renderRoute(url, context, event.signal)
  });
  return true;
}

async function renderRoute(url: URL, context: NavigationContext, signal: AbortSignal) {
  if (signal.aborted) {
    return;
  }

  const match = matchRouteManifest(url.pathname, context.manifest);
  const loadPageModule = match && context.pageModuleLoaders[match.route.file];
  if (!match || !loadPageModule) {
    context.window.location.assign(url.href);
    return;
  }

  preloadRouteBundles(match.route.pathname);

  const [page, document] = await Promise.all([
    loadPageModule(),
    context.documentModuleLoader?.()
  ]);
  if (signal.aborted) {
    return;
  }

  dispatchRouteUpdate(context.window.document, {
    document: document as RouteDocumentModule | undefined,
    page: page as never,
    route: {
      file: match.route.file,
      params: match.params,
      status: 200,
      url: url.href
    }
  });
}

function handleLinkClick(
  event: MouseEvent,
  context: NavigationContext,
  navigation: ResumableNavigationRuntime
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }

  const anchor = sourceAnchor(event);
  if (!anchor || !anchor.hasAttribute(LINK_ATTRIBUTE) || !isEligibleLink(anchor)) {
    return;
  }

  const url = parseSameOriginUrl(anchor.href, context.window.location.href);
  const match = url && matchRouteManifest(url.pathname, context.manifest);
  if (!match) {
    return;
  }

  event.preventDefault();
  preloadRouteBundles(match.route.pathname);
  navigation.navigate(url.href, {
    history: anchor.hasAttribute(REPLACE_ATTRIBUTE) ? "replace" : "push",
    info: {
      [LINK_INFO]: true,
      scroll: anchor.getAttribute(SCROLL_ATTRIBUTE) === "manual" ? "manual" : undefined
    }
  });
}

function preloadRouteBundles(routePathname: string) {
  preload(routePathname, 1);
}

function routeUrl(event: NavigateEvent, context: NavigationContext) {
  if (
    !isResumableNavigation(event) ||
    event.canIntercept === false ||
    event.navigationType === "reload" ||
    event.hashChange ||
    event.downloadRequest != null ||
    event.formData != null
  ) {
    return undefined;
  }

  const url = parseSameOriginUrl(event.destination.url, context.window.location.href);
  return url && matchRouteManifest(url.pathname, context.manifest) ? url : undefined;
}

function isResumableNavigation(event: NavigateEvent) {
  const info = event.info as Record<string, unknown> | undefined;
  return info?.[LINK_INFO] === true || event.navigationType === "traverse";
}

function navigationScroll(event: NavigateEvent): NavigationScrollBehavior {
  const info = event.info as Record<string, unknown> | undefined;
  return info?.[LINK_INFO] === true && info.scroll === "manual"
    ? "manual"
    : "after-transition";
}

function parseSameOriginUrl(href: string, base: string) {
  try {
    const current = new URL(base);
    const url = new URL(href, current);
    return url.origin === current.origin ? url : undefined;
  } catch {
    return undefined;
  }
}

function sourceAnchor(event: Event) {
  const target = (event.composedPath?.()[0] ?? event.target) as
    | {
        readonly closest?: (selector: string) => Element | null;
        readonly parentElement?: {
          readonly closest?: (selector: string) => Element | null;
        } | null;
      }
    | null
    | undefined;

  return (target?.closest?.("a[href]") ?? target?.parentElement?.closest?.("a[href]")) as
    | HTMLAnchorElement
    | null
    | undefined;
}

function isEligibleLink(anchor: HTMLAnchorElement) {
  const target = anchor.getAttribute("target");
  return (
    (!target || target === "_self") &&
    !anchor.hasAttribute("download") &&
    !anchor.relList?.contains("external")
  );
}

function browserWindow(): ResumableNavigationWindow {
  return window as unknown as ResumableNavigationWindow;
}
