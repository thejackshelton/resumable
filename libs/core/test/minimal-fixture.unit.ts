import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { join } from "pathe";
import { describe, expect, it } from "vite-plus/test";
import { createBuilder } from "vite";
import ts from "typescript";

const fixtureUrl = new URL("../../../fixtures/minimal/", import.meta.url);
const fixtureRoot = fileURLToPath(fixtureUrl);
const appFixtureUrl = new URL("../../../fixtures/app/", import.meta.url);
const execFile = promisify(execFileCallback);

interface BuiltNitroResponse {
  readonly path: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly headers: Record<string, string>;
  readonly body: string;
}

describe("Resumable fixtures", () => {
  it("renders static pages through Resumable's internal Qwik SSR renderer", async () => {
    await expectPath("pages/index.tsx", true);
    await expectPath("pages/about.tsx", true);
    await expectPath("pages/404.tsx", true);
    await expectPath("pages/500.tsx", true);
    await expectPath("pages/links.tsx", true);
    await expectPath("pages/missing-default.tsx", true);
    await expectPath("pages/throws.tsx", true);
    await expectPath("api/health.ts", true);
    await expectPath("api/throws.ts", true);
    await expectPath("public", true);
    await expectPath("package.json", true);
    await expectPath("tsconfig.json", true);
    await expectPath("vite.config.ts", true);
    await expectPath("nitro.config.ts", false);
    await expectPath("resumable.config.ts", false);
    await expectPath("src/pages", false);
    await expectPath("pages/api", false);

    const viteConfig = await readFile(fixturePath("vite.config.ts"), "utf-8");
    expect(viteConfig).toContain("plugins: [qwik(), resumable()]");
    expect(viteConfig).not.toContain("nitro()");

    await cleanBuildOutput();

    const builder = await createBuilder({
      root: fixtureRoot,
      configFile: fileURLToPath(fixturePath("vite.config.ts")),
      logLevel: "silent"
    });
    await builder.buildApp();

    const serverOutput = await readFile(fixturePath(".output/server/index.mjs"), "utf-8");
    expect(serverOutput).toContain("./_ssr/ssr.mjs");

    const serverEntry = (await import(
      `${fixturePath(".output/server/_ssr/ssr.mjs").href}?t=${Date.now()}`
    )) as {
      default: {
        fetch(request: Request): Promise<Response>;
      };
    };
    const html = await renderPage(serverEntry, "/");

    expect(html).toContain("Minimal Resumable Fixture");
    expect(html).toContain('lang="en"');
    expect(html.toLowerCase()).toContain('charset="utf-8"');
    expect(html).toContain('name="viewport"');
    expect(html.indexOf("<body")).toBeGreaterThan(-1);
    expect(html.indexOf("<main")).toBeGreaterThan(html.indexOf("<body"));
    expect(html.indexOf("</body>")).toBeGreaterThan(html.indexOf("<main"));
    expect(html).toMatch(/q:container|q:version|q:render|qwikloader|modulepreload/);

    await expect(renderPage(serverEntry, "/about")).resolves.toContain("About page");
    await expect(renderPage(serverEntry, "/blog/test")).resolves.toContain(
      "Static blog test page"
    );
    await expect(renderPage(serverEntry, "/blog/hello")).resolves.toContain(
      "Dynamic blog slug: hello"
    );
    await expect(
      renderPage(serverEntry, "/docs/guides/getting-started")
    ).resolves.toContain("Docs catch-all slug: guides/getting-started");
    const linksHtml = await renderPage(serverEntry, "/links");
    expect(linksHtml).toContain("Link fixture");
    expect(linksHtml).toMatch(
      /<script(?=[^>]*\btype="module")(?=[^>]*\bsrc="\/build\/q-[^"]+\.js")[^>]*>/
    );
    expect(linksHtml).toContain("Static Link");
    expect(linksHtml).toContain("Dynamic Link");
    expect(linksHtml).toContain("Catch-all Link");
    expect(linksHtml).toMatch(
      /<a(?=[^>]*\bdata-resumable-link)(?=[^>]*\bhref="\/about")[^>]*>/
    );
    expect(linksHtml).toMatch(
      /<a(?=[^>]*\bdata-resumable-link)(?=[^>]*\bhref="\/blog\/fixture-link-post")[^>]*>/
    );
    expect(linksHtml).toMatch(
      /<a(?=[^>]*\bdata-resumable-link)(?=[^>]*\bhref="\/docs\/guides\/fixture")[^>]*>/
    );
    expect(linksHtml).toContain('href="/about"');
    expect(linksHtml).toContain('href="/blog/fixture-link-post"');
    expect(linksHtml).toContain('href="/docs/guides/fixture"');
    expect(linksHtml).toContain('class="link-static"');
    expect(linksHtml).toContain('class="link-dynamic"');
    expect(linksHtml).toContain('class="link-catch-all"');
    expect(linksHtml).toContain('data-kind="dynamic-link"');
    expect(linksHtml).not.toContain("params=");

    const clientOutput = await readBuiltClientOutput(fixtureUrl);
    expect(clientOutput).toContain("__resumableStartSpaNavigation");

    const notFoundResponse = await fetchPage(serverEntry, "/ccc?hello=test");
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.headers.get("content-type")).toContain("text/html");
    const notFoundHtml = await notFoundResponse.text();
    expect(notFoundHtml).toContain(">404</h1>");
    expect(notFoundHtml).toContain("Status: 404");
    expect(notFoundHtml).toContain("Pathname: /ccc");
    expect(notFoundHtml).toContain("Search: ?hello=test");
    expect(notFoundHtml).toContain("Href: http://resumable.test/ccc?hello=test");
    expect(notFoundHtml).toContain("Params: 0");

    const renderFailureResponse = await fetchPage(serverEntry, "/throws?debug=yes");
    expect(renderFailureResponse.status).toBe(500);
    expect(renderFailureResponse.headers.get("content-type")).toContain("text/html");
    const renderFailureHtml = await renderFailureResponse.text();
    expect(renderFailureHtml).toContain(">500</h1>");
    expect(renderFailureHtml).toContain("Status: 500");
    expect(renderFailureHtml).toContain("Pathname: /throws");
    expect(renderFailureHtml).toContain("Search: ?debug=yes");
    expect(renderFailureHtml).toContain("Href: http://resumable.test/throws?debug=yes");
    expect(renderFailureHtml).toContain("Params: 0");

    const invalidPageResponse = await fetchPage(serverEntry, "/missing-default");
    expect(invalidPageResponse.status).toBe(500);
    await expect(invalidPageResponse.text()).resolves.toContain(
      "Page module must default export a Qwik component: pages/missing-default.tsx"
    );

    const nitroResponses = await fetchBuiltNitroServer([
      "/api/health",
      "/api/missing",
      "/api/throws",
      "/ccc?hello=test",
      "/throws?debug=yes"
    ]);

    const apiHealthResponse = nitroResponses.get("/api/health")!;
    expect(apiHealthResponse.status).toBe(200);
    expect(apiHealthResponse.contentType).toContain("application/json");
    expect(JSON.parse(apiHealthResponse.body)).toEqual({
      ok: true,
      route: "api/health"
    });
    expect(apiHealthResponse.body).not.toContain(">404</h1>");
    expect(apiHealthResponse.body).not.toContain(">500</h1>");

    const missingApiResponse = nitroResponses.get("/api/missing")!;
    expect(missingApiResponse.status).toBe(404);
    expect(missingApiResponse.contentType).toContain("application/json");
    expect(JSON.parse(missingApiResponse.body)).toMatchObject({
      error: true,
      status: 404
    });
    expect(missingApiResponse.body).not.toContain(">404</h1>");
    expect(missingApiResponse.body).not.toContain(">500</h1>");

    const throwingApiResponse = nitroResponses.get("/api/throws")!;
    expect(throwingApiResponse.status).toBe(503);
    expect(throwingApiResponse.contentType).toContain("application/json");
    expect(JSON.parse(throwingApiResponse.body)).toMatchObject({
      error: true,
      status: 503
    });
    expect(throwingApiResponse.body).toContain("API unavailable");
    expect(throwingApiResponse.body).not.toContain(">404</h1>");
    expect(throwingApiResponse.body).not.toContain(">500</h1>");

    const nitroNotFoundPageResponse = nitroResponses.get("/ccc?hello=test")!;
    expect(nitroNotFoundPageResponse.status).toBe(404);
    expect(nitroNotFoundPageResponse.contentType).toContain("text/html");
    expect(nitroNotFoundPageResponse.body).toContain(">404</h1>");
    expect(nitroNotFoundPageResponse.body).toContain("Search: ?hello=test");

    const nitroRenderFailureResponse = nitroResponses.get("/throws?debug=yes")!;
    expect(nitroRenderFailureResponse.status).toBe(500);
    expect(nitroRenderFailureResponse.contentType).toContain("text/html");
    expect(nitroRenderFailureResponse.body).toContain(">500</h1>");
    expect(nitroRenderFailureResponse.body).toContain("Search: ?debug=yes");
  });

  it("uses top-level document.tsx as the document shell", async () => {
    await expectPath("document.tsx", true, appFixtureUrl);

    await buildFixture(appFixtureUrl);
    const responses = await fetchBuiltSsrServer(appFixtureUrl, [
      "/",
      "/missing?from=test",
      "/throws"
    ]);

    const homeResponse = responses.get("/")!;
    expect(homeResponse.status).toBe(200);
    expect(homeResponse.contentType).toContain("text/html");
    const homeHtml = homeResponse.body;
    expect(homeHtml).toMatch(/<html[^>]*data-path="\/"/);
    expect(homeHtml).toMatch(/<html[^>]*data-status="200"/);
    expect(homeHtml).toMatch(/<body[^>]*data-status="200"/);
    expect(homeHtml).toMatch(/<body[^>]*data-path="\/"/);
    expect(homeHtml.indexOf("Shell home")).toBeLessThan(
      homeHtml.indexOf("App fixture page")
    );

    const notFoundResponse = responses.get("/missing?from=test")!;
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.contentType).toContain("text/html");
    const notFoundHtml = notFoundResponse.body;
    expect(notFoundHtml).toMatch(/<html[^>]*data-path="\/missing"/);
    expect(notFoundHtml).toMatch(/<html[^>]*data-status="404"/);
    expect(notFoundHtml).toMatch(/<body[^>]*data-status="404"/);
    expect(notFoundHtml).toMatch(/<body[^>]*data-path="\/missing"/);
    expect(notFoundHtml.indexOf("Shell missing")).toBeLessThan(
      notFoundHtml.indexOf("App fixture 404")
    );

    const errorResponse = responses.get("/throws")!;
    expect(errorResponse.status).toBe(500);
    expect(errorResponse.contentType).toContain("text/html");
    const errorHtml = errorResponse.body;
    expect(errorHtml).toMatch(/<html[^>]*data-path="\/throws"/);
    expect(errorHtml).toMatch(/<html[^>]*data-status="500"/);
    expect(errorHtml).toMatch(/<body[^>]*data-status="500"/);
    expect(errorHtml).toContain("App fixture 500");
  });

  it("uses top-level document.jsx as the document shell", async () => {
    const jsxFixtureUrl = await createTemporaryDocumentShellFixture({
      "document.jsx": documentShellJsxCode,
      "pages/index.tsx": pageCode("JSX document shell page")
    });

    try {
      await buildFixture(jsxFixtureUrl);
      const responses = await fetchBuiltSsrServer(jsxFixtureUrl, ["/"]);
      const homeResponse = responses.get("/")!;

      expect(homeResponse.status).toBe(200);
      expect(homeResponse.contentType).toContain("text/html");
      expect(homeResponse.body).toMatch(/<html[^>]*data-app="jsx"/);
      expect(homeResponse.body).toMatch(/<body[^>]*data-shell="jsx"/);
      expect(homeResponse.body).toContain("JSX document shell page");
    } finally {
      await rm(jsxFixtureUrl, { recursive: true, force: true });
    }
  });

  it("generates route declarations that project TypeScript discovers without route imports", async () => {
    const typedRoutesFixtureUrl = await createTemporaryTypedRoutesFixture();

    try {
      await buildFixture(typedRoutesFixtureUrl);

      await expect(
        readFile(new URL("resumable-env.d.ts", typedRoutesFixtureUrl), "utf-8")
      ).resolves.toBe('/// <reference path="./.resumable/types/routes.d.ts" />\n');
      await expect(
        readFile(new URL(".resumable/types/routes.d.ts", typedRoutesFixtureUrl), "utf-8")
      ).resolves.toContain("export type ResumableAnchorProps =");
      await expect(
        readFile(new URL(".resumable/types/routes.d.ts", typedRoutesFixtureUrl), "utf-8")
      ).resolves.toContain("export type ResumableLinkProps =");

      await expectProjectTypecheck(typedRoutesFixtureUrl);
      await expectProjectAnchorCompletions(typedRoutesFixtureUrl);
    } finally {
      await rm(typedRoutesFixtureUrl, { recursive: true, force: true });
    }
  });

  it("lowers route-pattern native anchors for SSR and client builds", async () => {
    const anchorFixtureUrl = await createTemporaryAnchorLoweringFixture();

    try {
      await buildFixture(anchorFixtureUrl);

      const responses = await fetchBuiltSsrServer(anchorFixtureUrl, ["/links"]);
      const linksResponse = responses.get("/links")!;
      expect(linksResponse.status).toBe(200);
      expect(linksResponse.contentType).toContain("text/html");
      expect(linksResponse.body).toContain('href="/blog/hello%20world"');
      expect(linksResponse.body).toContain('href="/blog/a%2Fb"');
      expect(linksResponse.body).toContain('href="/docs/guides/getting%20started"');
      expect(linksResponse.body).toContain('href="/blog/link%20post"');
      expect(linksResponse.body).toContain('class="post-link"');
      expect(linksResponse.body).toContain('class="link-post"');
      expect(linksResponse.body).toContain('data-kind="dynamic"');
      expect(linksResponse.body).toContain('data-kind="link"');
      expect(linksResponse.body).toContain('target="_self"');
      expect(linksResponse.body).toContain('rel="nofollow"');
      expect(linksResponse.body).not.toContain("params=");

      const clientOutput = await readBuiltClientOutput(anchorFixtureUrl);
      expect(clientOutput).toContain("/blog/[slug]");
      expect(clientOutput).toContain("hello world");
      expect(clientOutput).toContain("a/b");
      expect(clientOutput).toContain("link post");
      expect(clientOutput).toContain("getting started");
      expect(clientOutput).toContain("requires a non-empty catch-all param");
      expect(clientOutput).not.toContain("params=");
    } finally {
      await rm(anchorFixtureUrl, { recursive: true, force: true });
    }
  });

  it("fails builds for invalid route-pattern native anchors", async () => {
    const anchorFixtureUrl = await createTemporaryInvalidAnchorLoweringFixture();

    try {
      await expect(buildFixture(anchorFixtureUrl)).rejects.toThrow(
        "Typed route error: /missing/[slug] does not match any route in pages/."
      );
    } finally {
      await rm(anchorFixtureUrl, { recursive: true, force: true });
    }
  });

  it("keeps HTTP middleware, public assets, and routeRules native around page rendering", async () => {
    const nitroFixtureUrl = await createTemporaryNitroPassthroughFixture();

    try {
      await buildFixture(nitroFixtureUrl);

      const publicAssetOutput = await readFile(
        new URL(".output/public/resumable-m7.txt", nitroFixtureUrl),
        "utf-8"
      );
      expect(publicAssetOutput).toBe("served by Nitro public assets\n");

      const responses = await fetchBuiltNitroServer(
        [
          "/about",
          "/api/middleware-context",
          "/blocked-by-middleware",
          "/resumable-m7.txt"
        ],
        nitroFixtureUrl
      );

      const pageResponse = responses.get("/about")!;
      expect(pageResponse.status).toBe(200);
      expect(pageResponse.contentType).toContain("text/html");
      expect(pageResponse.headers["x-resumable-middleware"]).toBe("ran");
      expect(pageResponse.headers["x-resumable-route-rule"]).toBe("about");
      expect(pageResponse.body).toContain("M7 page");

      const apiResponse = responses.get("/api/middleware-context")!;
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.contentType).toContain("application/json");
      expect(apiResponse.headers["x-resumable-middleware"]).toBe("ran");
      expect(apiResponse.headers["x-resumable-api-rule"]).toBe("context");
      expect(JSON.parse(apiResponse.body)).toEqual({
        requestId: "m7-middleware"
      });

      const shortCircuitResponse = responses.get("/blocked-by-middleware")!;
      expect(shortCircuitResponse.status).toBe(418);
      expect(shortCircuitResponse.headers["x-resumable-short-circuit"]).toBe("yes");
      expect(shortCircuitResponse.body).toBe("blocked by middleware");
      expect(shortCircuitResponse.body).not.toContain(">404</h1>");

      const publicAssetResponse = responses.get("/resumable-m7.txt")!;
      expect(publicAssetResponse.status).toBe(200);
      expect(publicAssetResponse.contentType).toContain("text/plain");
      expect(publicAssetResponse.body).toBe("served by Nitro public assets\n");
      expect(publicAssetResponse.body).not.toContain("M7 page");
    } finally {
      await rm(nitroFixtureUrl, { recursive: true, force: true });
    }
  });
});

async function renderPage(
  serverEntry: {
    default: {
      fetch(request: Request): Promise<Response>;
    };
  },
  pathname: string
) {
  const response = await fetchPage(serverEntry, pathname);
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");

  return html;
}

async function fetchPage(
  serverEntry: {
    default: {
      fetch(request: Request): Promise<Response>;
    };
  },
  pathname: string
) {
  return serverEntry.default.fetch(new Request(`http://resumable.test${pathname}`));
}

async function fetchBuiltNitroServer(paths: readonly string[], rootUrl = fixtureUrl) {
  const script = `
process.env.NITRO_PORT = "0";
await import(${JSON.stringify(new URL(".output/server/index.mjs", rootUrl).href)});
const app = globalThis.__nitro__?.default;
if (!app || typeof app.fetch !== "function") {
  throw new Error("Built Nitro server entry did not expose globalThis.__nitro__.default.fetch");
}

const paths = ${JSON.stringify(paths)};
const responses = [];
for (const path of paths) {
  const response = await app.fetch(new Request(\`http://resumable.test\${path}\`));
  responses.push({
    path,
    status: response.status,
    contentType: response.headers.get("content-type"),
    headers: Object.fromEntries(response.headers),
    body: await response.text()
  });
}

console.log(JSON.stringify(responses));
process.exit(0);
`;
  const { stdout } = await execFile(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: fileURLToPath(rootUrl)
    }
  );
  const results = JSON.parse(stdout.trim().split("\n").at(-1)!) as BuiltNitroResponse[];

  return new Map(results.map((result) => [result.path, result]));
}

async function buildFixture(rootUrl: URL) {
  await cleanBuildOutput(rootUrl);
  await ensureFixtureNodeModules(rootUrl);

  const builder = await createBuilder({
    root: fileURLToPath(rootUrl),
    configFile: fileURLToPath(new URL("vite.config.ts", rootUrl)),
    logLevel: "silent"
  });
  await builder.buildApp();
}

async function fetchBuiltSsrServer(rootUrl: URL, paths: readonly string[]) {
  const script = `
const serverEntry = await import(${JSON.stringify(
    new URL(".output/server/_ssr/ssr.mjs", rootUrl).href
  )});

const paths = ${JSON.stringify(paths)};
const responses = [];
for (const path of paths) {
  const response = await serverEntry.default.fetch(new Request(\`http://resumable.test\${path}\`));
  responses.push({
    path,
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text()
  });
}

console.log(JSON.stringify(responses));
process.exit(0);
`;
  const { stdout } = await execFile(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: fileURLToPath(rootUrl)
    }
  );
  const results = JSON.parse(stdout.trim().split("\n").at(-1)!) as BuiltNitroResponse[];

  return new Map(results.map((result) => [result.path, result]));
}

async function expectPath(path: string, exists: boolean, rootUrl = fixtureUrl) {
  await expect(pathExists(path, rootUrl)).resolves.toBe(exists);
}

async function pathExists(path: string, rootUrl: URL) {
  try {
    await stat(new URL(path, rootUrl));
    return true;
  } catch {
    return false;
  }
}

async function ensureFixtureNodeModules(rootUrl: URL) {
  if (await pathExists("node_modules", rootUrl)) {
    return;
  }

  await symlink(fixturePath("node_modules"), new URL("node_modules", rootUrl), "dir");
}

function fixturePath(path: string) {
  return new URL(path, fixtureUrl);
}

async function cleanBuildOutput(rootUrl = fixtureUrl) {
  await rm(new URL(".output", rootUrl), { recursive: true, force: true });
  await rm(new URL("node_modules/.nitro", rootUrl), { recursive: true, force: true });
}

async function createTemporaryDocumentShellFixture(files: Record<string, string>) {
  return createTemporaryFixture("resumable-document-shell-", files, minimalViteConfig);
}

async function createTemporaryNitroPassthroughFixture() {
  return createTemporaryFixture(
    "resumable-nitro-passthrough-",
    {
      "pages/about.tsx": pageCode("M7 page"),
      "api/middleware-context.ts": nitroPassthroughApiCode,
      "middleware/00.request.ts": nitroPassthroughMiddlewareCode,
      "public/resumable-m7.txt": "served by Nitro public assets\n"
    },
    nitroPassthroughViteConfig
  );
}

async function createTemporaryTypedRoutesFixture() {
  return createTemporaryFixture(
    "resumable-typed-routes-",
    {
      "pages/index.tsx": pageCode("Typed routes home"),
      "pages/about.tsx": pageCode("Typed routes about"),
      "pages/blog/[slug].tsx": pageCode("Typed routes blog"),
      "pages/completion-proof.tsx": typedRoutesCompletionProofPageCode,
      "type-proof.tsx": typedRoutesProofPageCode
    },
    minimalViteConfig
  );
}

async function createTemporaryAnchorLoweringFixture() {
  return createTemporaryFixture(
    "resumable-anchor-lowering-",
    {
      "pages/index.tsx": pageCode("Anchor lowering home"),
      "pages/links.tsx": anchorLoweringPageCode,
      "pages/blog/[slug].tsx": pageCode("Anchor lowering blog"),
      "pages/docs/[...slug].tsx": pageCode("Anchor lowering docs")
    },
    minimalViteConfig
  );
}

async function createTemporaryInvalidAnchorLoweringFixture() {
  return createTemporaryFixture(
    "resumable-invalid-anchor-lowering-",
    {
      "pages/index.tsx": pageCode("Invalid anchor home"),
      "pages/broken.tsx": invalidAnchorLoweringPageCode
    },
    minimalViteConfig
  );
}

async function readBuiltClientOutput(rootUrl: URL) {
  const files = await collectFiles(new URL(".output/public/", rootUrl));
  const jsFiles = files.filter(
    (file) => file.pathname.endsWith(".js") || file.pathname.endsWith(".mjs")
  );
  const chunks = await Promise.all(jsFiles.map((file) => readFile(file, "utf-8")));
  return chunks.join("\n");
}

async function collectFiles(rootUrl: URL): Promise<URL[]> {
  const entries = await readdir(rootUrl, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(entry.name, rootUrl);
      if (entry.isDirectory()) {
        return collectFiles(new URL(`${entry.name}/`, rootUrl));
      }

      return entry.isFile() ? [entryUrl] : [];
    })
  );

  return nested.flat();
}

async function expectProjectTypecheck(rootUrl: URL) {
  const root = fileURLToPath(rootUrl);
  const tsconfigPath = fileURLToPath(new URL("tsconfig.json", rootUrl));
  const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(formatTsDiagnostics([config.error]));
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
    {
      noEmit: true,
      skipLibCheck: true
    },
    tsconfigPath
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  expect(formatTsDiagnostics(diagnostics)).toEqual([]);
}

async function expectProjectAnchorCompletions(rootUrl: URL) {
  const root = fileURLToPath(rootUrl);
  const tsconfigPath = fileURLToPath(new URL("tsconfig.json", rootUrl));
  const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(formatTsDiagnostics([config.error]).join("\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
    {
      noEmit: true,
      skipLibCheck: true
    },
    tsconfigPath
  );
  const languageService = ts.createLanguageService({
    getCompilationSettings: () => parsed.options,
    getCurrentDirectory: () => root,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => parsed.fileNames,
    getScriptSnapshot(fileName) {
      const source = ts.sys.readFile(fileName);
      return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
    },
    getScriptVersion: () => "0",
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath
  });

  const pageUrl = new URL("pages/completion-proof.tsx", rootUrl);
  const fileName = fileURLToPath(pageUrl);
  const source = await readFile(pageUrl, "utf-8");

  expectAnchorPropCompletion(languageService, fileName, source, 'href="/about"  />');
  expectAnchorPropCompletion(
    languageService,
    fileName,
    source,
    'href="/blog/[slug]" params={{ slug: "hello" }}  />'
  );
}

function expectAnchorPropCompletion(
  languageService: ts.LanguageService,
  fileName: string,
  source: string,
  marker: string
) {
  const offset = source.indexOf(marker);
  if (offset === -1) {
    throw new Error(`completion marker not found: ${marker}`);
  }

  const position = offset + marker.indexOf("  />") + 1;
  const completions = languageService.getCompletionsAtPosition(fileName, position, {});
  const names = completions?.entries.map((entry) => entry.name) ?? [];

  expect(names).toContain("onClick$");
  expect(names).toContain("target");
  expect(names).toContain("rel");
}

function formatTsDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  return diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  );
}

async function createTemporaryFixture(
  prefix: string,
  files: Record<string, string>,
  viteConfig: string
) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const rootUrl = pathToFileURL(`${root}/`);

  await writeFile(new URL("package.json", rootUrl), minimalPackageJson);
  await writeFile(new URL("tsconfig.json", rootUrl), minimalTsconfigJson);
  await writeFile(new URL("vite.config.ts", rootUrl), viteConfig);
  await symlink(fixturePath("node_modules"), new URL("node_modules", rootUrl), "dir");

  await Promise.all(
    Object.entries(files).map(async ([path, contents]) => {
      const fileUrl = new URL(path, rootUrl);
      await mkdir(new URL("./", fileUrl), { recursive: true });
      await writeFile(fileUrl, contents);
    })
  );

  return rootUrl;
}

const minimalPackageJson = `{
  "name": "resumable-fixture-document-shell",
  "private": true,
  "type": "module"
}
`;

const minimalTsconfigJson = `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@qwik.dev/core",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["resumable-env.d.ts", "document.tsx", "document.jsx", "type-proof.tsx", "pages", "vite.config.ts"]
}
`;

const minimalViteConfig = `import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
`;

const nitroPassthroughViteConfig = `import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    routeRules: {
      "/about": {
        headers: {
          "x-resumable-route-rule": "about"
        }
      },
      "/api/middleware-context": {
        headers: {
          "x-resumable-api-rule": "context"
        }
      }
    }
  }
});
`;

const nitroPassthroughMiddlewareCode = `export default function (http) {
  http.locals.requestId = "m7-middleware";
  http.response.headers.set("x-resumable-middleware", "ran");

  if (http.url.pathname === "/blocked-by-middleware") {
    return new Response("blocked by middleware", {
      status: 418,
      headers: {
        "x-resumable-short-circuit": "yes"
      }
    });
  }
}
`;

const nitroPassthroughApiCode = `export default function (http) {
  return {
    requestId: http.locals.requestId
  };
}
`;

const documentShellJsxCode = `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$(() => {
  return (
    <Html lang="en" data-app="jsx">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body data-shell="jsx">
        <Slot />
      </body>
    </Html>
  );
});
`;

const pageCode = (title: string) => `import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return <main>${title}</main>;
});
`;

const typedRoutesProofPageCode = `import { component$ } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const validAbout = <a href="/about" />;
  const validBlog = <a href="/blog/[slug]" params={{ slug: "hello" }} />;
  const validLinkAbout = <Link href="/about" prefetch="intent" replace scroll={false} />;
  const validLinkBlog = <Link href="/blog/[slug]" params={{ slug: "hello" }} class="post" />;

  // @ts-expect-error unknown route
  const missing = <a href="/missing" />;

  // @ts-expect-error dynamic route patterns require params
  const missingParams = <a href="/blog/[slug]" />;

  // @ts-expect-error dynamic route params must match the route pattern
  const wrongParams = <a href="/blog/[slug]" params={{ id: "hello" }} />;

  // @ts-expect-error static routes do not accept params
  const staticParams = <a href="/about" params={{ slug: "hello" }} />;

  // @ts-expect-error unknown Link route
  const missingLink = <Link href="/missing" />;

  // @ts-expect-error dynamic Link route patterns require params
  const missingLinkParams = <Link href="/blog/[slug]" />;

  // @ts-expect-error dynamic Link route params must match the route pattern
  const wrongLinkParams = <Link href="/blog/[slug]" params={{ id: "hello" }} />;

  // @ts-expect-error static Link routes do not accept params
  const staticLinkParams = <Link href="/about" params={{ slug: "hello" }} />;

  return (
    <nav>
      {validAbout}
      {validBlog}
      {validLinkAbout}
      {validLinkBlog}
      {missing}
      {missingParams}
      {wrongParams}
      {staticParams}
      {missingLink}
      {missingLinkParams}
      {wrongLinkParams}
      {staticLinkParams}
    </nav>
  );
});
`;

const typedRoutesCompletionProofPageCode = `import { component$ } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const staticAnchor = <a href="/about"  />;
  const dynamicAnchor = <a href="/blog/[slug]" params={{ slug: "hello" }}  />;
  const staticLink = <Link href="/about"  />;
  const dynamicLink = <Link href="/blog/[slug]" params={{ slug: "hello" }}  />;

  return (
    <nav>
      {staticAnchor}
      {dynamicAnchor}
      {staticLink}
      {dynamicLink}
    </nav>
  );
});
`;

const anchorLoweringPageCode = `import { component$ } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const spacedSlug = "hello world";
  const slashSlug = "a/b";
  const linkSlug = "link post";

  return (
    <nav>
      <a
        class="post-link"
        data-kind="dynamic"
        href="/blog/[slug]"
        params={{ slug: spacedSlug }}
        target="_self"
      >
        Blog
      </a>
      <a href="/blog/[slug]" params={{ slug: slashSlug }}>
        Slash
      </a>
      <a href="/docs/[...slug]" params={{ slug: ["guides", "getting started"] }} rel="nofollow">
        Docs
      </a>
      <Link
        class="link-post"
        data-kind="link"
        href="/blog/[slug]"
        params={{ slug: linkSlug }}
        prefetch="intent"
        replace
        scroll={false}
      >
        Link
      </Link>
      <Link href="/about">Static Link</Link>
    </nav>
  );
});
`;

const invalidAnchorLoweringPageCode = `import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return <a href="/missing/[slug]" params={{ slug: "hello" }}>Broken</a>;
});
`;
