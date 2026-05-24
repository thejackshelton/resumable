import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vite-plus/test";
import {
  CreateProgram,
  PROJECT_FORMAT_CHOICES,
  STARTER_CHOICES,
  type ProgramRuntime
} from "../src/index.ts";

const fakeRuntime = (cwd: string): ProgramRuntime => ({
  cwd: () => cwd,
  env: {
    npm_config_user_agent: "pnpm/9.14.4 npm/? node/?"
  },
  isTTY: false
});

const makeWorkspace = () => mkdtemp(join(tmpdir(), "resumable-cli-"));

const exists = async (path: string) =>
  stat(path)
    .then(() => true)
    .catch(() => false);

describe("CreateProgram", () => {
  it("keeps only supported project formats and starters visible", () => {
    expect(PROJECT_FORMAT_CHOICES.map((choice) => choice.value)).toEqual([
      "node",
      "bun",
      "deno"
    ]);
    expect(STARTER_CHOICES.map((choice) => choice.value)).toEqual([
      "minimal",
      "app",
      "full-stack"
    ]);
  });

  it("keeps the official CLI package shape", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf-8")
    ) as {
      name: string;
      bin: Record<string, string>;
    };

    expect(packageJson).toMatchObject({
      name: "@resumable.dev/cli",
      bin: {
        "create-resumable": "./lib/index.mjs",
        resumable: "./lib/index.mjs"
      }
    });
  });

  it("uses shared path and URL helpers instead of Node path/url imports", async () => {
    const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf-8");

    expect(source).toContain('from "pathe"');
    expect(source).toContain('from "ufo"');
    expect(source).not.toMatch(/from "node:(path|url)"/);
  });

  it("--yes selects the deterministic minimal Node defaults", async () => {
    const cwd = await makeWorkspace();
    const program = new CreateProgram();
    const validated = program.validate(["my-app", "--yes"], fakeRuntime(cwd));
    const options = await program.interact(validated, fakeRuntime(cwd));

    expect(options).toMatchObject({
      target: "my-app",
      format: "node",
      starter: "minimal",
      install: true,
      git: true,
      packageManager: "pnpm"
    });
  });

  it("generates the minimal app shape without future config files", async () => {
    const cwd = await makeWorkspace();
    const program = new CreateProgram();

    await program.run(["my-app", "--yes", "--no-install", "--no-git"], fakeRuntime(cwd));

    const appDir = join(cwd, "my-app");
    const packageJson = JSON.parse(
      await readFile(join(appDir, "package.json"), "utf-8")
    ) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const viteConfig = await readFile(join(appDir, "vite.config.ts"), "utf-8");

    expect(packageJson.scripts).toEqual({
      dev: "vp dev",
      build: "vp build",
      preview: "vp preview",
      check: "vp check",
      format: "vp fmt",
      test: "vp test"
    });
    expect(packageJson.dependencies).toHaveProperty("@qwik.dev/core");
    expect(packageJson.devDependencies).toMatchObject({
      "@resumable.dev/core": expect.any(String),
      "qwik-bundler": expect.any(String),
      nitro: expect.any(String),
      vite: expect.any(String),
      "vite-plus": expect.any(String)
    });
    expect(viteConfig).toContain('import { defineConfig } from "vite-plus";');
    expect(viteConfig).toContain('import { qwik } from "qwik-bundler/vite";');
    expect(viteConfig).toContain('import { resumable } from "@resumable.dev/core/vite";');
    expect(viteConfig).toContain("plugins: [qwik(), resumable()]");
    expect(viteConfig).not.toContain("nitro()");

    await expect(
      readFile(join(appDir, "pages", "index.tsx"), "utf-8")
    ).resolves.toContain("export default");
    await expect(exists(join(appDir, "resumable.config.ts"))).resolves.toBe(false);
    await expect(exists(join(appDir, "nitro.config.ts"))).resolves.toBe(false);
    await expect(exists(join(appDir, "src", "pages"))).resolves.toBe(false);
    await expect(exists(join(appDir, "pages", "api"))).resolves.toBe(false);
  });

  it("rejects --yes without a positional target", async () => {
    const cwd = await makeWorkspace();
    const program = new CreateProgram();

    expect(() => program.validate(["--yes"], fakeRuntime(cwd))).toThrow(
      "Project name is required when running non-interactively."
    );
  });
});
