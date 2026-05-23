import { rm, stat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { createBuilder } from "vite";

const fixtureUrl = new URL("../../../fixtures/minimal/", import.meta.url);
const fixtureRoot = fileURLToPath(fixtureUrl);

describe("minimal Resumable fixture", () => {
  it("renders static pages through Resumable's internal Qwik SSR renderer", async () => {
    await expectPath("pages/index.tsx", true);
    await expectPath("pages/about.tsx", true);
    await expectPath("pages/404.tsx", true);
    await expectPath("pages/500.tsx", true);
    await expectPath("pages/missing-default.tsx", true);
    await expectPath("pages/throws.tsx", true);
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

async function expectPath(path: string, exists: boolean) {
  await expect(pathExists(path)).resolves.toBe(exists);
}

async function pathExists(path: string) {
  try {
    await stat(fixturePath(path));
    return true;
  } catch {
    return false;
  }
}

function fixturePath(path: string) {
  return new URL(path, fixtureUrl);
}

async function cleanBuildOutput() {
  await rm(fixturePath(".output"), { recursive: true, force: true });
  await rm(fixturePath("node_modules/.nitro"), { recursive: true, force: true });
}
