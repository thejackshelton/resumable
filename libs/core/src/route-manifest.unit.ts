import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";
import {
  buildRouteManifestFromFileIds,
  matchRouteManifest,
  type RouteManifest
} from "./route-manifest.ts";

const routePairs = (manifest: RouteManifest) =>
  manifest.routes.map((route) => [route.pathname, route.file]);

describe("route manifest", () => {
  it("builds static .tsx pages from Vite-discovered file ids", () => {
    expect(
      buildRouteManifestFromFileIds([
        "/pages/index.tsx",
        "/pages/about.tsx",
        "/pages/blog/index.tsx",
        "/pages/blog/intro.tsx"
      ])
    ).toMatchObject({
      routes: [
        { pathname: "/", file: "pages/index.tsx" },
        { pathname: "/about", file: "pages/about.tsx" },
        { pathname: "/blog", file: "pages/blog/index.tsx" },
        { pathname: "/blog/intro", file: "pages/blog/intro.tsx" }
      ]
    });
  });

  it("keeps Nitro-native and non-canonical page directories out of UI routes", () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/api/health.tsx",
      "/middleware/auth.tsx",
      "/public/example.tsx",
      "/src/pages/hidden.tsx"
    ]);

    expect(routePairs(manifest)).toEqual([["/", "pages/index.tsx"]]);
  });

  it("normalizes dynamic and catch-all .tsx page routes", () => {
    expect(
      buildRouteManifestFromFileIds([
        "/pages/blog/[slug].tsx",
        "/pages/docs/[...slug].tsx"
      ])
    ).toMatchObject({
      routes: [
        {
          pathname: "/blog/:slug",
          file: "pages/blog/[slug].tsx",
          params: [{ name: "slug", kind: "dynamic" }]
        },
        {
          pathname: "/docs/**",
          file: "pages/docs/[...slug].tsx",
          params: [{ name: "slug", kind: "catch-all" }]
        }
      ]
    });
  });

  it("matches static routes before dynamic routes and extracts dynamic params", () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/blog/[slug].tsx",
      "/pages/blog/test.tsx"
    ]);

    expect(matchRouteManifest("/blog/test", manifest)).toMatchObject({
      route: { file: "pages/blog/test.tsx" },
      params: {}
    });
    expect(matchRouteManifest("/blog/hello", manifest)).toMatchObject({
      route: { file: "pages/blog/[slug].tsx" },
      params: { slug: "hello" }
    });
    expect(matchRouteManifest("/missing", manifest)).toBeUndefined();
  });

  it("matches catch-all routes after static and dynamic routes", () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/docs/[...slug].tsx",
      "/pages/docs/[section].tsx",
      "/pages/docs/guides.tsx"
    ]);

    expect(matchRouteManifest("/docs/guides", manifest)).toMatchObject({
      route: { file: "pages/docs/guides.tsx" },
      params: {}
    });
    expect(matchRouteManifest("/docs/reference", manifest)).toMatchObject({
      route: { file: "pages/docs/[section].tsx" },
      params: { section: "reference" }
    });
    expect(matchRouteManifest("/docs/guides/getting-started", manifest)).toMatchObject({
      route: { file: "pages/docs/[...slug].tsx" },
      params: { slug: "guides/getting-started" }
    });
    expect(matchRouteManifest("/docs", manifest)).toBeUndefined();
  });

  it("reserves root status pages without adding normal /404 or /500 routes", () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/404.tsx",
      "/pages/500.tsx"
    ]);

    expect(routePairs(manifest)).toEqual([["/", "pages/index.tsx"]]);
    expect(manifest.statusPages).toEqual({
      notFound: "pages/404.tsx",
      error: "pages/500.tsx"
    });
  });

  it("fails on static route conflicts with exact files", () => {
    expect(() =>
      buildRouteManifestFromFileIds(["/pages/blog.tsx", "/pages/blog/index.tsx"])
    ).toThrow(
      [
        "Route conflict: /blog is defined by both:",
        "- pages/blog.tsx",
        "- pages/blog/index.tsx"
      ].join("\n")
    );
  });

  it("fails on dynamic route conflicts regardless of parameter name", () => {
    expect(() =>
      buildRouteManifestFromFileIds(["/pages/blog/[id].tsx", "/pages/blog/[slug].tsx"])
    ).toThrow(
      [
        "Route conflict: /blog/:param is defined by both:",
        "- pages/blog/[id].tsx",
        "- pages/blog/[slug].tsx"
      ].join("\n")
    );
  });

  it("fails on unsupported page-tree API routes", () => {
    expect(() => buildRouteManifestFromFileIds(["/pages/api/health.tsx"])).toThrow(
      "API routes inside pages/ are not supported. Use top-level api/: pages/api/health.tsx"
    );
  });

  it("fails on non-final catch-all routes", () => {
    expect(() =>
      buildRouteManifestFromFileIds(["/pages/docs/[...slug]/edit.tsx"])
    ).toThrow("Catch-all route segments must be final: pages/docs/[...slug]/edit.tsx");
  });

  it("keeps manifest normalization free of Node filesystem and path imports", async () => {
    const source = await readFile(
      new URL("./route-manifest.ts", import.meta.url),
      "utf-8"
    );

    expect(source).toContain('from "pathe"');
    expect(source).toContain('from "ufo"');
    expect(source).not.toMatch(/from "node:(fs|path)/);
    expect(source).not.toContain("replace(/\\\\/g");
    expect(source).not.toContain("replace(/^\\/+");
  });
});
