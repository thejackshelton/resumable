import { describe, expect, it } from "vite-plus/test";
import { parseRequestFile } from "../src/request-files.ts";

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
        "export default async function (event) { return event.context.params.id; }"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "event"
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
      parseRequestFile("api/posts.ts", "export default async (event) => ({ ok: true });")
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "event"
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
        "const route = async (event) => event.context.params.path; export default route;"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "event"
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
        "export default async (event) => { event.context.user = {}; };"
      )
    ).toMatchObject({
      defaultExport: {
        kind: "function",
        parameterName: "event"
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
});
