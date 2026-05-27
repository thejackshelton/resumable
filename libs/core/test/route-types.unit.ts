import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";
import { buildRouteManifestFromFileIds } from "../src/route-manifest.ts";
import {
  createRouteTypesDeclaration,
  routeTypesEnvDeclaration
} from "../src/route-types.ts";

describe("route type declarations", () => {
  it("creates concrete hrefs, route patterns, and params from the route manifest", () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/blog/test.tsx",
      "/pages/docs/[...slug].tsx",
      "/pages/404.tsx",
      "/pages/500.tsx"
    ]);

    const declaration = createRouteTypesDeclaration(manifest);

    expect(routeTypesEnvDeclaration).toBe(
      '/// <reference path="./.resumable/types/routes.d.ts" />\n'
    );
    expect(declaration).toContain("import type { QwikHTMLElements }");
    expect(declaration).toContain("export type ResumableStaticPageHref =");
    expect(declaration).toContain("export type ResumableConcretePageHref =");
    expect(declaration).toContain('| "/"');
    expect(declaration).toContain('| "/about"');
    expect(declaration).toContain('| "/blog/test"');
    expect(declaration).toContain("| `/blog/${string}`");
    expect(declaration).toContain("| `/docs/${string}`");
    expect(declaration).not.toContain('| "/404"');
    expect(declaration).not.toContain('| "/500"');

    expect(declaration).toContain("export type ResumableRoutePattern =");
    expect(declaration).toContain('| "/blog/[slug]"');
    expect(declaration).toContain('| "/docs/[...slug]"');

    expect(declaration).toContain('"/blog/[slug]": {');
    expect(declaration).toContain("readonly slug: string | number;");
    expect(declaration).toContain('"/docs/[...slug]": {');
    expect(declaration).toContain(
      "readonly slug: string | number | readonly (string | number)[];"
    );

    expect(declaration).toContain("export type ResumableAnchorProps =");
    expect(declaration).toContain("export type ResumableLinkProps =");
    expect(declaration).toContain("interface ResumableGeneratedRoutes");
    expect(declaration).toContain("readonly link: ResumableLinkProps;");
    expect(declaration).toContain('declare module "@qwik.dev/core"');
    expect(declaration).toContain("interface IntrinsicElements");
  });

  it("produces TypeScript route types that accept and reject expected values", async () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/docs/[...slug].tsx",
      "/pages/404.tsx",
      "/pages/500.tsx"
    ]);
    const routesFile = "/routes.d.ts";
    const testFile = "/test.ts";
    const sources = new Map([
      [routesFile, createRouteTypesDeclaration(manifest)],
      [
        testFile,
        [
          'import type { ResumableConcretePageHref, ResumableRouteParams, ResumableRoutePattern } from "./routes";',
          "",
          'const home: ResumableConcretePageHref = "/";',
          'const about: ResumableConcretePageHref = "/about";',
          'const blog: ResumableConcretePageHref = "/blog/hello";',
          'const docs: ResumableConcretePageHref = "/docs/guides/getting-started";',
          "// @ts-expect-error unknown concrete route",
          'const missing: ResumableConcretePageHref = "/missing";',
          "",
          'const blogPattern: ResumableRoutePattern = "/blog/[slug]";',
          "// @ts-expect-error static routes are not route patterns",
          'const aboutPattern: ResumableRoutePattern = "/about";',
          "",
          'const blogParams: ResumableRouteParams["/blog/[slug]"] = { slug: "hello" };',
          'const docsParams: ResumableRouteParams["/docs/[...slug]"] = { slug: ["guides", "intro"] };',
          "// @ts-expect-error wrong dynamic param name",
          'const badBlogParams: ResumableRouteParams["/blog/[slug]"] = { id: "hello" };',
          "",
          "void home;",
          "void about;",
          "void blog;",
          "void docs;",
          "void missing;",
          "void blogPattern;",
          "void aboutPattern;",
          "void blogParams;",
          "void docsParams;",
          "void badBlogParams;"
        ].join("\n")
      ]
    ]);

    const program = ts.createProgram(
      [testFile],
      {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2023
      },
      createMemoryCompilerHost(sources)
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
    ).toEqual([]);
  });

  it("produces Qwik JSX anchor types for concrete and pattern hrefs", async () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/docs/[...slug].tsx"
    ]);
    const testRoot = `${process.cwd()}/libs/core/.resumable-test`;
    const routesFile = `${testRoot}/routes.d.ts`;
    const testFile = `${testRoot}/test.tsx`;
    const sources = new Map([
      [routesFile, createRouteTypesDeclaration(manifest)],
      [
        testFile,
        [
          'const slug = "hello";',
          "",
          'const validHome = <a href="/" />;',
          'const validAbout = <a href="/about" />;',
          'const validBlog = <a href="/blog/[slug]" params={{ slug }} />;',
          'const validDocs = <a href="/docs/[...slug]" params={{ slug: ["guides", "intro"] }} />;',
          "",
          "// @ts-expect-error unknown route",
          'const missing = <a href="/missing" />;',
          "",
          "// @ts-expect-error dynamic route patterns require params",
          'const missingParams = <a href="/blog/[slug]" />;',
          "",
          "// @ts-expect-error dynamic route params must match the route pattern",
          'const wrongParams = <a href="/blog/[slug]" params={{ id: "hello" }} />;',
          "",
          "// @ts-expect-error static routes do not accept params",
          'const staticParams = <a href="/about" params={{ slug: "hello" }} />;',
          "",
          "void validHome;",
          "void validAbout;",
          "void validBlog;",
          "void validDocs;",
          "void missing;",
          "void missingParams;",
          "void wrongParams;",
          "void staticParams;"
        ].join("\n")
      ]
    ]);

    const program = ts.createProgram(
      [routesFile, testFile],
      {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "@qwik.dev/core",
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2023
      },
      createMemoryCompilerHost(sources)
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
    ).toEqual([]);
  });

  it("produces route-aware Link types from the generated route model", async () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/docs/[...slug].tsx"
    ]);
    const testRoot = `${process.cwd()}/libs/core/.resumable-test`;
    const routesFile = `${testRoot}/routes.d.ts`;
    const corePackageJson = `${testRoot}/node_modules/@resumable.dev/core/package.json`;
    const coreTypesFile = `${testRoot}/node_modules/@resumable.dev/core/index.d.ts`;
    const testFile = `${testRoot}/test.tsx`;
    const sources = new Map([
      [routesFile, createRouteTypesDeclaration(manifest)],
      [
        corePackageJson,
        JSON.stringify({
          name: "@resumable.dev/core",
          types: "index.d.ts"
        })
      ],
      [
        coreTypesFile,
        [
          'import type { Component, PropsOf } from "@qwik.dev/core";',
          "export interface ResumableGeneratedRoutes {}",
          'export type LinkProps = ResumableGeneratedRoutes extends { readonly link: infer Props } ? Props : PropsOf<"a">;',
          "export declare const Link: Component<LinkProps>;"
        ].join("\n")
      ],
      [
        testFile,
        [
          'import { Link } from "@resumable.dev/core";',
          "",
          'const slug = "hello";',
          "",
          'const validAbout = <Link href="/about" prefetch="intent" replace scroll={false}>About</Link>;',
          'const validBlog = <Link href="/blog/[slug]" params={{ slug }} class="post">Blog</Link>;',
          'const validDocs = <Link href="/docs/[...slug]" params={{ slug: ["guides", "intro"] }} />;',
          "",
          "// @ts-expect-error unknown route",
          'const missing = <Link href="/missing" />;',
          "",
          "// @ts-expect-error dynamic route patterns require params",
          'const missingParams = <Link href="/blog/[slug]" />;',
          "",
          "// @ts-expect-error dynamic route params must match the route pattern",
          'const wrongParams = <Link href="/blog/[slug]" params={{ id: "hello" }} />;',
          "",
          "// @ts-expect-error static routes do not accept params",
          'const staticParams = <Link href="/about" params={{ slug: "hello" }} />;',
          "",
          "void validAbout;",
          "void validBlog;",
          "void validDocs;",
          "void missing;",
          "void missingParams;",
          "void wrongParams;",
          "void staticParams;"
        ].join("\n")
      ]
    ]);

    const program = ts.createProgram(
      [routesFile, testFile],
      {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "@qwik.dev/core",
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        paths: {
          "@resumable.dev/core": [coreTypesFile]
        },
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2023
      },
      createMemoryCompilerHost(sources)
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
    ).toEqual([]);
  });

  it("preserves native anchor JSX completions", async () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/docs/[...slug].tsx"
    ]);
    const testRoot = `${process.cwd()}/libs/core/.resumable-test`;
    const routesFile = `${testRoot}/routes.d.ts`;
    const testFile = `${testRoot}/test.tsx`;
    const source = [
      "const anchor = <a  />;",
      'const linkedAnchor = <a href="/about"  />;',
      "const paragraph = <p  />;"
    ].join("\n");
    const sources = new Map([
      [routesFile, createRouteTypesDeclaration(manifest)],
      [testFile, source]
    ]);

    const languageService = createMemoryLanguageService(
      [routesFile, testFile],
      sources,
      {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "@qwik.dev/core",
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2023
      },
      testRoot
    );

    expect(completionNames(languageService, testFile, source, "<a ")).toEqual(
      expect.arrayContaining(["href", "onClick$", "target", "rel"])
    );
    expect(completionNames(languageService, testFile, source, 'href="/about" ')).toEqual(
      expect.arrayContaining(["onClick$", "target", "rel"])
    );
    expect(completionNames(languageService, testFile, source, "<p ")).toEqual(
      expect.arrayContaining(["onClick$", "class", "id"])
    );
  });

  it('produces route-aware PropsOf<"a"> types', async () => {
    const manifest = buildRouteManifestFromFileIds([
      "/pages/index.tsx",
      "/pages/about.tsx",
      "/pages/blog/[slug].tsx",
      "/pages/docs/[...slug].tsx"
    ]);
    const testRoot = `${process.cwd()}/libs/core/.resumable-test`;
    const routesFile = `${testRoot}/routes.d.ts`;
    const testFile = `${testRoot}/test.ts`;
    const sources = new Map([
      [routesFile, createRouteTypesDeclaration(manifest)],
      [
        testFile,
        [
          'import type { PropsOf } from "@qwik.dev/core";',
          "",
          'const validAbout: PropsOf<"a"> = { href: "/about" };',
          'const validBlog: PropsOf<"a"> = { href: "/blog/[slug]", params: { slug: "hello" } };',
          "",
          "// @ts-expect-error unknown route",
          'const missing: PropsOf<"a"> = { href: "/missing" };',
          "",
          "// @ts-expect-error dynamic route patterns require params",
          'const missingParams: PropsOf<"a"> = { href: "/blog/[slug]" };',
          "",
          "// @ts-expect-error dynamic route params must match the route pattern",
          'const wrongParams: PropsOf<"a"> = { href: "/blog/[slug]", params: { id: "hello" } };',
          "",
          "// @ts-expect-error static routes do not accept params",
          'const staticParams: PropsOf<"a"> = { href: "/about", params: { slug: "hello" } };',
          "",
          "void validAbout;",
          "void validBlog;",
          "void missing;",
          "void missingParams;",
          "void wrongParams;",
          "void staticParams;"
        ].join("\n")
      ]
    ]);

    const program = ts.createProgram(
      [routesFile, testFile],
      {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2023
      },
      createMemoryCompilerHost(sources)
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
    ).toEqual([]);
  });
});

function createMemoryLanguageService(
  fileNames: readonly string[],
  sources: ReadonlyMap<string, string>,
  compilerOptions: ts.CompilerOptions,
  currentDirectory: string
) {
  return ts.createLanguageService({
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => currentDirectory,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [...fileNames],
    getScriptSnapshot(fileName) {
      const source = sources.get(fileName) ?? ts.sys.readFile(fileName);
      return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
    },
    getScriptVersion: () => "0",
    readDirectory: ts.sys.readDirectory,
    readFile: (fileName) => sources.get(fileName) ?? ts.sys.readFile(fileName),
    fileExists: (fileName) => sources.has(fileName) || ts.sys.fileExists(fileName),
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath
  });
}

function completionNames(
  languageService: ts.LanguageService,
  fileName: string,
  source: string,
  marker: string
) {
  const offset = source.indexOf(marker);
  if (offset === -1) {
    throw new Error(`completion marker not found: ${marker}`);
  }

  const completions = languageService.getCompletionsAtPosition(
    fileName,
    offset + marker.length,
    {}
  );

  return completions?.entries.map((entry) => entry.name) ?? [];
}

function createMemoryCompilerHost(sources: ReadonlyMap<string, string>) {
  const host = ts.createCompilerHost({});
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);

  host.fileExists = (fileName) => sources.has(fileName) || originalFileExists(fileName);
  host.readFile = (fileName) => sources.get(fileName) ?? originalReadFile(fileName);
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile
  ) => {
    const source = sources.get(fileName);
    if (source !== undefined) {
      return ts.createSourceFile(fileName, source, languageVersion);
    }

    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  };

  return host;
}
