import { describe, expect, it } from "vite-plus/test";
import {
  __resumableStartSpaNavigation,
  handleNavigateEvent,
  type ResumableNavigationWindow
} from "../src/spa-navigation.ts";
import { RESUMABLE_ROUTE_EVENT } from "../src/route-state.ts";

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

function clickEvent(target: unknown) {
  return {
    altKey: false,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    prevented: false,
    shiftKey: false,
    target,
    preventDefault() {
      this.prevented = true;
    }
  };
}

function testAnchor(
  href: string,
  options: {
    readonly link?: boolean;
  } = {}
) {
  const anchor = {
    href,
    relList: {
      contains: () => false
    },
    closest: () => anchor,
    getAttribute(name: string) {
      return name === "target" ? null : undefined;
    },
    hasAttribute(name: string) {
      return options.link && name === "data-resumable-link";
    }
  };
  return anchor;
}

function component(name: string) {
  return () => name;
}
