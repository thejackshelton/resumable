import { execFile as execFileCallback } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
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

const fixtureUrl = new URL("../../../fixtures/minimal/", import.meta.url);
const fixtureRoot = fileURLToPath(fixtureUrl);
const appFixtureUrl = new URL("../../../fixtures/app/", import.meta.url);
const execFile = promisify(execFileCallback);

interface BuiltNitroResponse {
  readonly path: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: string;
}

describe("Resumable fixtures", () => {
  it("renders static pages through Resumable's internal Qwik SSR renderer", async () => {
    await expectPath("app.tsx", false);
    await expectPath("pages/index.tsx", true);
    await expectPath("pages/about.tsx", true);
    await expectPath("pages/404.tsx", true);
    await expectPath("pages/500.tsx", true);
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
    expect(html).toContain('<meta charSet="utf-8"');
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

  it("uses top-level app.tsx as the document app shell", async () => {
    await expectPath("app.tsx", true, appFixtureUrl);

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

  it("uses top-level app.jsx as the document app shell", async () => {
    const jsxFixtureUrl = await createTemporaryAppShellFixture({
      "app.jsx": appShellJsxCode,
      "pages/index.tsx": pageCode("JSX app shell page")
    });

    try {
      await buildFixture(jsxFixtureUrl);
      const responses = await fetchBuiltSsrServer(jsxFixtureUrl, ["/"]);
      const homeResponse = responses.get("/")!;

      expect(homeResponse.status).toBe(200);
      expect(homeResponse.contentType).toContain("text/html");
      expect(homeResponse.body).toMatch(/<html[^>]*data-app="jsx"/);
      expect(homeResponse.body).toMatch(/<body[^>]*data-shell="jsx"/);
      expect(homeResponse.body).toContain("JSX app shell page");
    } finally {
      await rm(jsxFixtureUrl, { recursive: true, force: true });
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

async function fetchBuiltNitroServer(paths: readonly string[]) {
  const script = `
process.env.NITRO_PORT = "0";
await import(${JSON.stringify(fixturePath(".output/server/index.mjs").href)});
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
      cwd: fixtureRoot
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

async function createTemporaryAppShellFixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "resumable-app-shell-"));
  const rootUrl = pathToFileURL(`${root}/`);

  await writeFile(new URL("package.json", rootUrl), minimalPackageJson);
  await writeFile(new URL("tsconfig.json", rootUrl), minimalTsconfigJson);
  await writeFile(new URL("vite.config.ts", rootUrl), minimalViteConfig);
  await symlink(fixturePath("node_modules"), new URL("node_modules", rootUrl), "dir");

  await Promise.all(
    Object.entries(files).map(async ([path, contents]) => {
      const fileUrl = new URL(path, rootUrl);
      await mkdir(new URL("./", fileUrl), { recursive: true });
      await writeFile(fileUrl, contents);
    })
  );

  await cp(fixturePath("public"), new URL("public", rootUrl), {
    recursive: true,
    errorOnExist: false
  });

  return rootUrl;
}

const minimalPackageJson = `{
  "name": "resumable-fixture-app-shell",
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
  "include": ["app.tsx", "app.jsx", "pages", "vite.config.ts"]
}
`;

const minimalViteConfig = `import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
`;

const appShellJsxCode = `import { component$, Slot } from "@qwik.dev/core";
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
