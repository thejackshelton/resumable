import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  __resumableStartSpaNavigation,
  handleNavigateEvent,
  type ResumableNavigationWindow
} from "../src/spa-navigation.ts";
import { RESUMABLE_ROUTE_EVENT } from "../src/route-state.ts";

const preloaderMock = vi.hoisted(() => ({
  preload: vi.fn()
}));

vi.mock("@qwik.dev/core/preloader", () => ({
  p: preloaderMock.preload
}));

beforeEach(() => {
  preloaderMock.preload.mockClear();
});

describe("SPA navigation", () => {
  it("renders the next route from the client page module graph", async () => {
    const document = new EventTarget() as Document;
    let update: CustomEvent["detail"];
    document.addEventListener(RESUMABLE_ROUTE_EVENT, (event) => {
      update = (event as CustomEvent).detail;
    });
    const context = {
      documentModuleLoader: async () => ({ default: component("document") }),
      manifest: {
        routes: [
          {
            file: "pages/about.tsx",
            params: [],
            pathname: "/about",
            pattern: "/about"
          }
        ],
        statusPages: {}
      },
      pageModuleLoaders: {
        "pages/about.tsx": async () => ({ default: component("about") })
      },
      window: {
        document,
        location: { href: "http://resumable.test/" }
      }
    };
    const event = navigateEvent("http://resumable.test/about", {
      info: { __resumableLink: true }
    });

    expect(handleNavigateEvent(event, context as never)).toBe(true);
    await event.intercepted?.handler();

    expect(preloaderMock.preload).toHaveBeenCalledWith("/about", 1);
    expect(update?.route).toEqual({
      file: "pages/about.tsx",
      params: {},
      status: 200,
      url: "http://resumable.test/about"
    });
    expect(update?.page.default()).toBe("about");
    expect(update?.document.default()).toBe("document");
  });

  it("does not intercept routes outside the page manifest", () => {
    const context = {
      manifest: { routes: [], statusPages: {} },
      pageModuleLoaders: {},
      window: {
        document: new EventTarget(),
        location: { href: "http://resumable.test/" }
      }
    };
    const event = navigateEvent("http://resumable.test/file.pdf", {
      info: { __resumableLink: true }
    });

    expect(handleNavigateEvent(event, context as never)).toBe(false);
    expect(event.intercepted).toBeUndefined();
  });

  it("does not intercept regular browser route navigations", () => {
    const context = {
      manifest: {
        routes: [
          {
            file: "pages/about.tsx",
            params: [],
            pathname: "/about",
            pattern: "/about"
          }
        ],
        statusPages: {}
      },
      pageModuleLoaders: {},
      window: {
        document: new EventTarget(),
        location: { href: "http://resumable.test/" }
      }
    };
    const event = navigateEvent("http://resumable.test/about");

    expect(handleNavigateEvent(event, context as never)).toBe(false);
    expect(event.intercepted).toBeUndefined();
  });

  it("uses the Navigation API runtime once and wires route discovery", async () => {
    const listeners: Record<string, (event: NavigateEvent) => void> = {};
    const runtimeWindow = {
      addEventListener() {},
      document: new EventTarget(),
      location: { href: "http://resumable.test/" },
      navigation: {
        addEventListener(type: string, listener: (event: NavigateEvent) => void) {
          listeners[type] = listener;
        },
        navigate() {}
      }
    } as unknown as ResumableNavigationWindow;

    await __resumableStartSpaNavigation({
      pageModuleLoaders: {
        "pages/index.tsx": async () => ({ default: component("home") })
      },
      routeFileIds: ["/pages/index.tsx"],
      window: runtimeWindow
    });
    await __resumableStartSpaNavigation({
      pageModuleLoaders: {},
      routeFileIds: [],
      window: runtimeWindow
    });

    expect(listeners.navigate).toEqual(expect.any(Function));
  });

  it("prevents browser reloads for internal Link anchors", async () => {
    let clickListener: ((event: MouseEvent) => void) | undefined;
    let navigated:
      | {
          readonly url: string;
          readonly options: {
            readonly history?: string;
            readonly info?: Record<string, unknown>;
          };
        }
      | undefined;
    const runtimeWindow = {
      addEventListener(type: string, listener: (event: MouseEvent) => void) {
        if (type === "click") {
          clickListener = listener;
        }
      },
      document: new EventTarget(),
      location: { href: "http://resumable.test/" },
      navigation: {
        addEventListener() {},
        navigate(
          url: string,
          options: {
            readonly history?: string;
            readonly info?: Record<string, unknown>;
          }
        ) {
          navigated = { url, options };
        }
      }
    } as unknown as ResumableNavigationWindow;
    const anchor = testAnchor("http://resumable.test/about", {
      link: true
    });

    await __resumableStartSpaNavigation({
      pageModuleLoaders: {
        "pages/about.tsx": async () => ({ default: component("about") })
      },
      routeFileIds: ["/pages/about.tsx"],
      window: runtimeWindow
    });

    const event = clickEvent(anchor);
    clickListener?.(event as never);

    expect(event.prevented).toBe(true);
    expect(preloaderMock.preload).toHaveBeenCalledWith("/about", 1);
    expect(navigated).toEqual({
      url: "http://resumable.test/about",
      options: {
        history: "push",
        info: {
          __resumableLink: true,
          scroll: undefined
        }
      }
    });
  });

  it("leaves regular anchors to the browser", async () => {
    let clickListener: ((event: MouseEvent) => void) | undefined;
    let navigatedUrl: string | undefined;
    const runtimeWindow = {
      addEventListener(type: string, listener: (event: MouseEvent) => void) {
        if (type === "click") {
          clickListener = listener;
        }
      },
      document: new EventTarget(),
      location: { href: "http://resumable.test/" },
      navigation: {
        addEventListener() {},
        navigate(url: string) {
          navigatedUrl = url;
        }
      }
    } as unknown as ResumableNavigationWindow;
    const anchor = testAnchor("http://resumable.test/about");

    await __resumableStartSpaNavigation({
      pageModuleLoaders: {
        "pages/about.tsx": async () => ({ default: component("about") })
      },
      routeFileIds: ["/pages/about.tsx"],
      window: runtimeWindow
    });

    const event = clickEvent(anchor);
    clickListener?.(event as never);

    expect(event.prevented).toBe(false);
    expect(navigatedUrl).toBeUndefined();
    expect(preloaderMock.preload).not.toHaveBeenCalled();
  });

  it("finds anchors when the click target is nested inside the link", async () => {
    let clickListener: ((event: MouseEvent) => void) | undefined;
    let navigatedUrl: string | undefined;
    const runtimeWindow = {
      addEventListener(type: string, listener: (event: MouseEvent) => void) {
        if (type === "click") {
          clickListener = listener;
        }
      },
      document: new EventTarget(),
      location: { href: "http://resumable.test/" },
      navigation: {
        addEventListener() {},
        navigate(url: string) {
          navigatedUrl = url;
        }
      }
    } as unknown as ResumableNavigationWindow;
    const anchor = testAnchor("http://resumable.test/about", {
      link: true
    });
    const textTarget = {
      parentElement: {
        closest: () => anchor
      }
    };

    await __resumableStartSpaNavigation({
      pageModuleLoaders: {
        "pages/about.tsx": async () => ({ default: component("about") })
      },
      routeFileIds: ["/pages/about.tsx"],
      window: runtimeWindow
    });

    const event = clickEvent(textTarget);
    clickListener?.(event as never);

    expect(event.prevented).toBe(true);
    expect(navigatedUrl).toBe("http://resumable.test/about");
  });

  it("leaves ineligible Link clicks to the browser", async () => {
    const cases: Array<{
      readonly anchor: ReturnType<typeof testAnchor>;
      readonly event?: ClickEventOptions;
      readonly name: string;
    }> = [
      {
        anchor: testAnchor("https://external.test/about", { link: true }),
        name: "external origin"
      },
      {
        anchor: testAnchor("http://resumable.test/about", {
          link: true,
          target: "_blank"
        }),
        name: "target"
      },
      {
        anchor: testAnchor("http://resumable.test/about", {
          download: true,
          link: true
        }),
        name: "download"
      },
      {
        anchor: testAnchor("http://resumable.test/about", {
          link: true,
          relExternal: true
        }),
        name: "rel external"
      },
      {
        anchor: testAnchor("http://resumable.test/about", { link: true }),
        event: { metaKey: true },
        name: "modifier key"
      },
      {
        anchor: testAnchor("http://resumable.test/about", { link: true }),
        event: { button: 1 },
        name: "non-primary click"
      }
    ];

    for (const testCase of cases) {
      preloaderMock.preload.mockClear();
      const { clickListener, navigatedUrls } = await startClickNavigation();

      const event = clickEvent(testCase.anchor, testCase.event);
      clickListener()?.(event as never);

      expect(event.prevented, testCase.name).toBe(false);
      expect(navigatedUrls, testCase.name).toEqual([]);
      expect(preloaderMock.preload, testCase.name).not.toHaveBeenCalled();
    }
  });

  it("passes replace and manual scroll options to the Navigation API", async () => {
    const { clickListener, navigatedUrls } = await startClickNavigation();
    const anchor = testAnchor("http://resumable.test/about", {
      link: true,
      replace: true,
      scroll: "manual"
    });

    const event = clickEvent(anchor);
    clickListener()?.(event as never);

    expect(event.prevented).toBe(true);
    expect(navigatedUrls).toEqual([
      {
        options: {
          history: "replace",
          info: {
            __resumableLink: true,
            scroll: "manual"
          }
        },
        url: "http://resumable.test/about"
      }
    ]);
  });

  it("enhances back and forward traverse events for known routes", async () => {
    const document = new EventTarget() as Document;
    let update: CustomEvent["detail"];
    document.addEventListener(RESUMABLE_ROUTE_EVENT, (event) => {
      update = (event as CustomEvent).detail;
    });
    const context = aboutRouteContext({ document });
    const event = navigateEvent("http://resumable.test/about", {
      navigationType: "traverse"
    });

    expect(handleNavigateEvent(event, context as never)).toBe(true);
    await event.intercepted?.handler();

    expect(update?.route).toEqual({
      file: "pages/about.tsx",
      params: {},
      status: 200,
      url: "http://resumable.test/about"
    });
  });

  it("leaves status-page fallback paths to document navigation", () => {
    const context = aboutRouteContext({
      statusPages: {
        notFound: "pages/404.tsx"
      }
    });
    const event = navigateEvent("http://resumable.test/missing", {
      info: { __resumableLink: true }
    });

    expect(handleNavigateEvent(event, context as never)).toBe(false);
    expect(event.intercepted).toBeUndefined();
  });
});

function navigateEvent(
  url: string,
  options: {
    readonly info?: Record<string, unknown>;
    readonly navigationType?: NavigationType;
  } = {}
) {
  return {
    canIntercept: true,
    destination: { url },
    downloadRequest: null,
    formData: null,
    hashChange: false,
    info: options.info,
    intercepted: undefined as
      | {
          readonly handler: () => Promise<void>;
        }
      | undefined,
    navigationType: options.navigationType ?? "push",
    intercept(interceptOptions: { readonly handler: () => Promise<void> }) {
      this.intercepted = interceptOptions;
    }
  };
}

function clickEvent(target: unknown, options: ClickEventOptions = {}) {
  return {
    altKey: options.altKey ?? false,
    button: options.button ?? 0,
    ctrlKey: options.ctrlKey ?? false,
    defaultPrevented: options.defaultPrevented ?? false,
    metaKey: options.metaKey ?? false,
    prevented: false,
    shiftKey: options.shiftKey ?? false,
    target,
    preventDefault() {
      this.prevented = true;
    }
  };
}

function testAnchor(
  href: string,
  options: {
    readonly download?: boolean;
    readonly link?: boolean;
    readonly relExternal?: boolean;
    readonly replace?: boolean;
    readonly scroll?: string;
    readonly target?: string;
  } = {}
) {
  const anchor = {
    href,
    relList: {
      contains: (rel: string) => rel === "external" && options.relExternal === true
    },
    closest: () => anchor,
    getAttribute(name: string) {
      if (name === "target") {
        return options.target ?? null;
      }
      if (name === "data-resumable-scroll") {
        return options.scroll;
      }
      return undefined;
    },
    hasAttribute(name: string) {
      return (
        (options.link === true && name === "data-resumable-link") ||
        (options.replace === true && name === "data-resumable-replace") ||
        (options.download === true && name === "download")
      );
    }
  };
  return anchor;
}

interface ClickEventOptions {
  readonly altKey?: boolean;
  readonly button?: number;
  readonly ctrlKey?: boolean;
  readonly defaultPrevented?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
}

async function startClickNavigation() {
  const runtime = clickNavigationRuntime();
  await __resumableStartSpaNavigation({
    pageModuleLoaders: {
      "pages/about.tsx": async () => ({ default: component("about") })
    },
    routeFileIds: ["/pages/about.tsx"],
    window: runtime.runtimeWindow
  });
  return runtime;
}

function clickNavigationRuntime() {
  let clickListener: ((event: MouseEvent) => void) | undefined;
  const navigatedUrls: Array<{
    readonly options?: {
      readonly history?: string;
      readonly info?: Record<string, unknown>;
    };
    readonly url: string;
  }> = [];
  const runtimeWindow = {
    addEventListener(type: string, listener: (event: MouseEvent) => void) {
      if (type === "click") {
        clickListener = listener;
      }
    },
    document: new EventTarget(),
    location: { href: "http://resumable.test/" },
    navigation: {
      addEventListener() {},
      navigate(
        url: string,
        options?: {
          readonly history?: string;
          readonly info?: Record<string, unknown>;
        }
      ) {
        navigatedUrls.push({ options, url });
      }
    }
  } as unknown as ResumableNavigationWindow;

  return {
    clickListener: () => clickListener,
    navigatedUrls,
    runtimeWindow
  };
}

function aboutRouteContext(
  options: {
    readonly document?: Document;
    readonly statusPages?: Record<string, string>;
  } = {}
) {
  return {
    manifest: {
      routes: [
        {
          file: "pages/about.tsx",
          params: [],
          pathname: "/about",
          pattern: "/about"
        }
      ],
      statusPages: options.statusPages ?? {}
    },
    pageModuleLoaders: {
      "pages/about.tsx": async () => ({ default: component("about") })
    },
    window: {
      document: options.document ?? new EventTarget(),
      location: { href: "http://resumable.test/" }
    }
  };
}

function component(name: string) {
  return () => name;
}
