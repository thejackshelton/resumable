import { describe, expect, it } from "vite-plus/test";
import type { JSXOutput } from "@qwik.dev/core";
import {
  createServerEntry,
  type ServerEntryOptions
} from "../../../src/vite/runtime/create-server-entry.ts";

describe("server entry document attributes", () => {
  it("passes document.tsx html attributes to Qwik before renderToString", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const entry = createServerEntry({
      documentModuleLoader: async () => ({
        default: component("document"),
        __resumableHtmlAttributes: (props: {
          readonly status: number;
          readonly url: { readonly pathname: string };
        }) => ({
          lang: "en",
          "data-path": props.url.pathname,
          "data-status": String(props.status)
        })
      }),
      pageModuleLoaders: {
        "pages/index.tsx": async () => ({ default: component("page") })
      },
      qwik: qwikRuntime(renderOptions),
      routeFileIds: ["/pages/index.tsx"]
    });

    const response = await entry.fetch(new Request("http://resumable.test/"));

    expect(response.status).toBe(200);
    expect(renderOptions[0]?.containerAttributes).toEqual({
      lang: "en",
      "data-path": "/",
      "data-status": "200"
    });
  });

  it("keeps default lang when document.tsx has no generated html attribute helper", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const entry = createServerEntry({
      documentModuleLoader: async () => ({
        default: component("document")
      }),
      pageModuleLoaders: {
        "pages/index.tsx": async () => ({ default: component("page") })
      },
      qwik: qwikRuntime(renderOptions),
      routeFileIds: ["/pages/index.tsx"]
    });

    const response = await entry.fetch(new Request("http://resumable.test/"));

    expect(response.status).toBe(200);
    expect(renderOptions[0]?.containerAttributes).toEqual({ lang: "en" });
  });

  it("renders the client entry script with the page body content", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const renderRoots: unknown[] = [];
    const entry = createServerEntry({
      clientEntryPath: "/build/q-client.js",
      documentModuleLoader: undefined,
      pageModuleLoaders: {
        "pages/index.tsx": async () => ({ default: component("page") })
      },
      qwik: qwikRuntime(renderOptions, renderRoots),
      routeFileIds: ["/pages/index.tsx"]
    });

    const response = await entry.fetch(new Request("http://resumable.test/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(renderOptions[0]?.manifest).toBeUndefined();
    expect(html).toBe("<html><head></head><body></body></html>");
    expect(scriptFromDefaultDocumentRoot(renderRoots[0])).toMatchObject({
      type: "script",
      props: { type: "module", src: "/build/q-client.js" }
    });
  });

  it("uses the same rendered body content path for dev client entries", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const renderRoots: unknown[] = [];
    const entry = createServerEntry({
      clientEntryPath: "/@id/virtual:resumable/client-entry",
      documentModuleLoader: undefined,
      pageModuleLoaders: {
        "pages/index.tsx": async () => ({ default: component("page") })
      },
      qwik: qwikRuntime(renderOptions, renderRoots),
      routeFileIds: ["/pages/index.tsx"]
    });

    const response = await entry.fetch(new Request("http://resumable.test/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(renderOptions[0]?.manifest).toBeUndefined();
    expect(html).toBe("<html><head></head><body></body></html>");
    expect(scriptFromDefaultDocumentRoot(renderRoots[0])).toMatchObject({
      type: "script",
      props: { type: "module", src: "/@id/virtual:resumable/client-entry" }
    });
  });
});

type QwikRuntime = ServerEntryOptions["qwik"];

function qwikRuntime(
  renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]>,
  renderRoots: unknown[] = []
): QwikRuntime {
  return {
    Fragment: Symbol("Fragment"),
    jsx: (type, props) => ({ type, props }) as JSXOutput,
    jsxs: (type, props) => ({ type, props }) as JSXOutput,
    async renderToString(root, options) {
      renderRoots.push(root);
      renderOptions.push(options);

      return { html: "<html><head></head><body></body></html>" };
    }
  } satisfies QwikRuntime;
}

function component(name: string) {
  return (() => name) as never;
}

function scriptFromDefaultDocumentRoot(root: unknown) {
  const documentChildren = (root as { props: { children: unknown[] } }).props.children;
  const body = documentChildren[1] as { props: { children: unknown } };
  const bodyChildren = body.props.children as { props: { children: unknown[] } };
  return bodyChildren.props.children[1];
}
