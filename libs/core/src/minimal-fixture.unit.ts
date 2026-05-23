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
  const response = await serverEntry.default.fetch(
    new Request(`http://resumable.test${pathname}`)
  );
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");

  return html;
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
