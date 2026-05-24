import { describe, expect, it } from "vite-plus/test";
import type { JSXOutput } from "@qwik.dev/core";
import {
  createServerEntry,
  type ServerEntryOptions
} from "../../../src/vite/runtime/create-server-entry.ts";

describe("server entry app document attributes", () => {
  it("passes app.tsx html attributes to Qwik before renderToString", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const entry = createServerEntry({
      appModuleLoader: async () => ({
        default: component("app"),
        __resumableHtmlAttributes: (props: {
          readonly status: number;
          readonly url: { readonly pathname: string };
        }) => ({
          lang: "en",
          "data-path": props.url.pathname,
          "data-status": String(props.status)
        })
      }),
      isDev: false,
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

  it("keeps default lang when app.tsx has no generated html attribute helper", async () => {
    const renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]> = [];
    const entry = createServerEntry({
      appModuleLoader: async () => ({
        default: component("app")
      }),
      isDev: false,
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
});

type QwikRuntime = ServerEntryOptions["qwik"];

function qwikRuntime(
  renderOptions: Array<Parameters<QwikRuntime["renderToString"]>[1]>
): QwikRuntime {
  return {
    Fragment: Symbol("Fragment"),
    jsx: (type, props) => ({ type, props }) as JSXOutput,
    jsxs: (type, props) => ({ type, props }) as JSXOutput,
    async renderToString(_root, options) {
      renderOptions.push(options);

      return { html: "<html></html>" };
    }
  } satisfies QwikRuntime;
}

function component(name: string) {
  return (() => name) as never;
}
