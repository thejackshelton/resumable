import { describe, expect, it } from "vite-plus/test";
import { parseRequestFile, transformRequestFileSource } from "../src/request-files.ts";

describe("request file parser", () => {
  it("classifies non-request files as neither API nor middleware", () => {
    expect(parseRequestFile("pages/index.tsx", "export default function Page() {}")).toEqual({
      diagnostics: [],
      file: "pages/index.tsx",
      kind: "none"
    });
  });

  it("parses API method suffixes, route params, and default functions", () => {
    expect(
      parseRequestFile(
        "api/users/[id].get.ts",
        "export default async function (http) { return http.params.id; }"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "http"
      },
      diagnostics: [],
      file: "api/users/[id].get.ts",
      kind: "api",
      method: "get",
      route: {
        params: [{ kind: "dynamic", name: "id" }],
        pathname: "/api/users/:id",
        pattern: "/api/users/[id]"
      }
    });
  });

  it("treats API files without a method suffix as all-method endpoints", () => {
    expect(
      parseRequestFile("api/posts.ts", "export default async (http) => ({ ok: true });")
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "http"
      },
      diagnostics: [],
      kind: "api",
      method: "all",
      route: {
        pathname: "/api/posts",
        pattern: "/api/posts",
        params: []
      }
    });
  });

  it("parses catch-all API params", () => {
    expect(
      parseRequestFile(
        "api/proxy/[...path].ts",
        "const route = async (http) => http.params.path; export default route;"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "http"
      },
      diagnostics: [],
      kind: "api",
      method: "all",
      route: {
        params: [{ kind: "catch-all", name: "path" }],
        pathname: "/api/proxy/**",
        pattern: "/api/proxy/[...path]"
      }
    });
  });

  it("parses endpoint cache metadata sidecar exports", () => {
    expect(
      parseRequestFile(
        "api/posts.get.ts",
        "export const cache = { maxAge: 60 }; export default function () {}"
      )
    ).toMatchObject({
      cache: { maxAge: 60 },
      diagnostics: [],
      kind: "api",
      method: "get"
    });
  });

  it("parses middleware default functions", () => {
    expect(
      parseRequestFile(
        "middleware/01.auth.ts",
        "export default async (http) => { http.locals.user = {}; };"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "http"
      },
      diagnostics: [],
      file: "middleware/01.auth.ts",
      kind: "middleware"
    });
  });

  it("diagnoses missing default function exports", () => {
    expect(parseRequestFile("api/posts.get.ts", "export const value = 1;").diagnostics).toEqual([
      {
        code: "missing-default-function",
        message: "API files must default export a function."
      }
    ]);

    expect(parseRequestFile("middleware/auth.ts", "export const value = 1;").diagnostics).toEqual([
      {
        code: "missing-default-function",
        message: "Middleware files must default export a function."
      }
    ]);
  });

  it("diagnoses HTTP method exports in API files", () => {
    expect(
      parseRequestFile(
        "api/posts.ts",
        "export async function GET() { return {}; } export default function () {}"
      ).diagnostics
    ).toEqual([
      {
        code: "http-method-export",
        message: "Do not export GET; the HTTP method comes from the filename."
      }
    ]);
  });

  it("diagnoses invalid endpoint cache metadata", () => {
    expect(
      parseRequestFile("api/posts.get.ts", "export const cache = 60; export default function () {}")
        .diagnostics
    ).toEqual([
      {
        code: "invalid-cache-metadata",
        message: "Use export const cache for endpoint cache metadata."
      }
    ]);
  });

  it("wraps API files so user handlers receive an HTTP context", () => {
    expect(
      transformRequestFileSource(
        "api/users/[id].get.ts",
        "export default async function (http) { return http.params.id; }"
      )?.code
    ).toContain(
      "import { __resumableCreateHttpContext as __resumable_create_http_context__ } from \"@resumable.dev/core\";"
    );
    expect(
      transformRequestFileSource(
        "api/users/[id].get.ts",
        "export default async function (http) { return http.params.id; }"
      )?.code
    ).toContain(
      "const __resumable_request_handler__ = async function (http) { return http.params.id; }"
    );
  });

  it("wraps cached API files with endpoint cache metadata", () => {
    expect(
      transformRequestFileSource(
        "api/posts.get.ts",
        "export const cache = { maxAge: 60 }; export default function () {}"
      )?.code
    ).toContain(
      'import { defineCachedHandler as __resumable_define_handler__ } from "nitro/cache";'
    );
  });

  it("wraps middleware files so user handlers receive an HTTP context", () => {
    expect(
      transformRequestFileSource(
        "middleware/01.auth.ts",
        "const auth = (http) => { http.locals.user = {}; }; export default auth;"
      )?.code
    ).toContain("auth(__resumable_create_http_context__(event))");
  });
});
