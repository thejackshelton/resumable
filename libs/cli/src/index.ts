import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import { basename, dirname, normalize, resolve } from "pathe";
import { decodePath, parseURL, withoutTrailingSlash } from "ufo";

declare const __VERSION__: string | undefined;

export type ProjectFormat = "node" | "bun" | "deno";
export type Starter = "minimal" | "app" | "full-stack";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "deno";

type Choice<T extends string> = {
  value: T;
  label: string;
  hint: string;
};

export const PROJECT_FORMAT_CHOICES = [
  { value: "node", label: "Node", hint: "package.json" },
  { value: "bun", label: "Bun", hint: "package.json" },
  { value: "deno", label: "Deno", hint: "deno.json" }
] as const satisfies readonly Choice<ProjectFormat>[];

export const STARTER_CHOICES = [
  { value: "minimal", label: "Minimal", hint: "one page" },
  { value: "app", label: "App", hint: "layouts, status pages" },
  {
    value: "full-stack",
    label: "Full-stack",
    hint: "app plus Nitro api/ and middleware/"
  }
] as const satisfies readonly Choice<Starter>[];

export interface ProgramRuntime {
  cwd(): string;
  env: Record<string, string | undefined>;
  isTTY: boolean;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stderr?: Pick<NodeJS.WriteStream, "write">;
  spawn?: (
    command: string,
    args: readonly string[],
    options: SpawnSyncOptions
  ) => ReturnType<typeof spawnSync>;
}

export interface CreateProgramConfig {
  name: string;
  description: string;
  version: string;
}

export interface ValidatedCreateInput {
  target?: string;
  format?: ProjectFormat;
  starter?: Starter;
  install?: boolean;
  git?: boolean;
  yes: boolean;
  force: boolean;
  help: boolean;
  version: boolean;
  cwd: string;
  packageManager: PackageManager;
}

export interface CreateOptions {
  target: string;
  format: ProjectFormat;
  starter: Starter;
  install: boolean;
  git: boolean;
  force: boolean;
  packageManager: PackageManager;
  cwd: string;
}

type Manifest = {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const DEFAULT_SCRIPTS = {
  dev: "vp dev",
  build: "vp build",
  preview: "vp preview",
  check: "vp check",
  format: "vp fmt",
  test: "vp test"
};

const DEFAULT_DEPENDENCIES = {
  "@qwik.dev/core": "^2.0.0-beta.0"
};

const DEFAULT_DEV_DEPENDENCIES = {
  "@resumable.dev/core": "latest",
  "@resumable.dev/typescript-plugin": "latest",
  nitro: "3.0.260429-beta",
  "qwik-bundler": "0.1",
  typescript: "^6.0.0",
  vite: "^8.0.0",
  "vite-plus": "^0.1.16"
};

export class CreateProgram {
  configure(): CreateProgramConfig {
    return {
      name: "create-resumable",
      version: typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0",
      description: "Create Resumable apps"
    };
  }

  validate(args: readonly string[], runtime = defaultRuntime()): ValidatedCreateInput {
    const parsed = parseArgs(args);

    if (parsed.target) {
      validateTarget(parsed.target);
    }

    if (parsed.yes && !parsed.target) {
      throw new Error("Project name is required when running non-interactively.");
    }

    if (!runtime.isTTY && !parsed.target && !parsed.help && !parsed.version) {
      throw new Error("Project name is required when running non-interactively.");
    }

    return {
      ...parsed,
      cwd: runtime.cwd(),
      packageManager: inferPackageManager(runtime.env)
    };
  }

  async interact(
    input: ValidatedCreateInput,
    runtime = defaultRuntime()
  ): Promise<CreateOptions> {
    if (input.yes) {
      return {
        target: input.target!,
        format: input.format ?? "node",
        starter: input.starter ?? "minimal",
        install: input.install ?? true,
        git: input.git ?? true,
        force: input.force,
        packageManager: input.packageManager,
        cwd: input.cwd
      };
    }

    if (!runtime.isTTY) {
      return {
        target: input.target!,
        format: input.format ?? "node",
        starter: input.starter ?? "minimal",
        install: input.install ?? true,
        git: input.git ?? true,
        force: input.force,
        packageManager: input.packageManager,
        cwd: input.cwd
      };
    }

    intro("create-resumable");

    const target =
      input.target ??
      ensurePromptValue(
        await text({
          message: "Project name",
          placeholder: "my-app",
          validate: (value) =>
            validateTarget(value) ? undefined : "Project name cannot be empty."
        })
      );

    const format =
      input.format ??
      ensurePromptValue(
        await select<ProjectFormat>({
          message: "Project format",
          options: [...PROJECT_FORMAT_CHOICES],
          initialValue: "node"
        })
      );

    const starter =
      input.starter ??
      ensurePromptValue(
        await select<Starter>({
          message: "Starter",
          options: [...STARTER_CHOICES],
          initialValue: "minimal"
        })
      );

    const install =
      input.install ??
      ensurePromptValue(
        await confirm({
          message: "Install dependencies?",
          initialValue: true
        })
      );

    const git =
      input.git ??
      ensurePromptValue(
        await confirm({
          message: "Initialize git?",
          initialValue: true
        })
      );

    return {
      target,
      format,
      starter,
      install,
      git,
      force: input.force,
      packageManager: input.packageManager,
      cwd: input.cwd
    };
  }

  async execute(options: CreateOptions, runtime = defaultRuntime()) {
    const targetDir = resolve(options.cwd, options.target);

    await ensureWritableTarget(targetDir, options.force);
    await writeStarter(options, targetDir);

    if (options.git) {
      runCommand(runtime, "git", ["init"], targetDir);
    }

    if (options.install) {
      runCommand(runtime, options.packageManager, ["install"], targetDir);
    }

    runtime.stdout?.write(`Created ${options.target}\n`);
    runtime.stdout?.write(
      `Next:\n  cd ${options.target}\n  ${options.packageManager} dev\n`
    );
    if (runtime.isTTY) {
      outro(`Created ${options.target}`);
    }
  }

  async run(args: readonly string[], runtime = defaultRuntime()) {
    const input = this.validate(args, runtime);

    if (input.help) {
      runtime.stdout?.write(helpText(this.configure()));
      return;
    }

    if (input.version) {
      runtime.stdout?.write(`${this.configure().version}\n`);
      return;
    }

    const options = await this.interact(input, runtime);
    await this.execute(options, runtime);
  }
}

function parseArgs(args: readonly string[]): ValidatedCreateInput {
  const parsed: ValidatedCreateInput = {
    yes: false,
    force: false,
    help: false,
    version: false,
    cwd: "",
    packageManager: "npm"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("-")) {
      if (parsed.target) {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      parsed.target = arg;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--install") {
      parsed.install = true;
      continue;
    }

    if (arg === "--no-install") {
      parsed.install = false;
      continue;
    }

    if (arg === "--git") {
      parsed.git = true;
      continue;
    }

    if (arg === "--no-git") {
      parsed.git = false;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      parsed.version = true;
      continue;
    }

    if (arg === "--format" || arg.startsWith("--format=")) {
      parsed.format = readChoice(
        "format",
        arg,
        arg.includes("=") ? undefined : args[++index],
        PROJECT_FORMAT_CHOICES
      );
      continue;
    }

    if (arg === "--starter" || arg.startsWith("--starter=")) {
      parsed.starter = readChoice(
        "starter",
        arg,
        arg.includes("=") ? undefined : args[++index],
        STARTER_CHOICES
      );
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function readChoice<T extends string>(
  name: string,
  arg: string,
  next: string | undefined,
  choices: readonly Choice<T>[]
): T {
  const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : next;

  if (!value) {
    throw new Error(`Missing value for --${name}.`);
  }

  if (!choices.some((choice) => choice.value === value)) {
    throw new Error(`Unsupported ${name}: ${value}`);
  }

  return value as T;
}

function validateTarget(target: string) {
  if (!target.trim()) {
    throw new Error("Project name cannot be empty.");
  }

  if (target.includes("\0")) {
    throw new Error("Project name contains invalid path characters.");
  }

  return true;
}

function ensurePromptValue<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error("Canceled.");
  }

  return value as T;
}

async function ensureWritableTarget(targetDir: string, force: boolean) {
  const targetStat = await stat(targetDir).catch(() => null);

  if (!targetStat) {
    await mkdir(targetDir, { recursive: true });
    return;
  }

  if (!targetStat.isDirectory()) {
    throw new Error(`Target exists and is not a directory: ${targetDir}`);
  }

  const files = await readdir(targetDir);
  if (files.length > 0 && !force) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }
}

async function writeStarter(options: CreateOptions, targetDir: string) {
  await Promise.all(
    starterFiles(options).map(async (file) => {
      const path = resolve(targetDir, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.contents);
    })
  );
}

function starterFiles(options: CreateOptions) {
  const files = [
    { path: "README.md", contents: readme(options) },
    { path: "vite.config.ts", contents: viteConfig() },
    { path: "tsconfig.json", contents: json(tsconfig()) },
    { path: "pages/index.tsx", contents: indexPage() },
    { path: "public/.gitkeep", contents: "" },
    ...manifestFiles(options)
  ];

  if (options.starter === "app" || options.starter === "full-stack") {
    files.push(
      { path: "document.tsx", contents: documentShell() },
      { path: "404.tsx", contents: statusPage("Not found") },
      { path: "500.tsx", contents: statusPage("Server error") }
    );
  }

  if (options.starter === "full-stack") {
    files.push(
      { path: "api/health.ts", contents: apiHealth() },
      { path: "middleware/request.ts", contents: requestMiddleware() }
    );
  }

  return files;
}

function manifestFiles(options: CreateOptions) {
  if (options.format === "deno") {
    return [{ path: "deno.json", contents: json(denoManifest()) }];
  }

  return [{ path: "package.json", contents: json(packageManifest(options)) }];
}

function packageManifest(options: CreateOptions): Manifest & {
  name: string;
  private: true;
  type: "module";
  packageManager?: string;
} {
  return {
    name: packageName(options.target),
    private: true,
    type: "module",
    ...(options.format === "bun" ? { packageManager: "bun" } : {}),
    scripts: DEFAULT_SCRIPTS,
    dependencies: DEFAULT_DEPENDENCIES,
    devDependencies: DEFAULT_DEV_DEPENDENCIES
  };
}

function denoManifest() {
  return {
    tasks: DEFAULT_SCRIPTS,
    nodeModulesDir: "auto",
    imports: {
      "@qwik.dev/core": "npm:@qwik.dev/core@^2.0.0-beta.0",
      "@resumable.dev/core/": "npm:@resumable.dev/core/",
      "qwik-bundler/vite": "npm:qwik-bundler/vite"
    }
  };
}

function tsconfig() {
  return {
    compilerOptions: {
      target: "ES2023",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      jsxImportSource: "@qwik.dev/core",
      strict: true,
      plugins: [
        {
          name: "@resumable.dev/typescript-plugin",
          pagesDir: "./pages"
        }
      ],
      types: ["vite/client"]
    },
    include: ["pages", "document.tsx", "404.tsx", "500.tsx", "vite.config.ts"]
  };
}

function viteConfig() {
  return `import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
`;
}

function indexPage() {
  return `import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return (
    <main>
      <h1>Resumable</h1>
      <p>Edit pages/index.tsx to get started.</p>
    </main>
  );
});
`;
}

function documentShell() {
  return `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$(() => {
  return (
    <Html lang="en">
      <head>
        <title>Resumable</title>
      </head>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
`;
}

function statusPage(title: string) {
  return `import { component$ } from "@qwik.dev/core";

export default component$(() => <h1>${title}</h1>);
`;
}

function apiHealth() {
  return `export default defineEventHandler(() => {
  return { ok: true };
});
`;
}

function requestMiddleware() {
  return `export default defineEventHandler((event) => {
  event.context.startedAt = Date.now();
});
`;
}

function readme(options: CreateOptions) {
  return `# ${packageName(options.target)}

## Commands

- ${options.packageManager} dev
- ${options.packageManager} build
- ${options.packageManager} preview
- ${options.packageManager} check
- ${options.packageManager} test
`;
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function packageName(target: string) {
  const name = basename(withoutTrailingSlash(normalize(target)))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return name || "resumable-app";
}

function inferPackageManager(env: ProgramRuntime["env"]): PackageManager {
  const userAgent = env.npm_config_user_agent ?? "";

  if (userAgent.startsWith("pnpm/")) {
    return "pnpm";
  }

  if (userAgent.startsWith("yarn/")) {
    return "yarn";
  }

  if (userAgent.startsWith("bun/")) {
    return "bun";
  }

  if (userAgent.startsWith("deno/")) {
    return "deno";
  }

  return "npm";
}

function runCommand(
  runtime: ProgramRuntime,
  command: string,
  args: readonly string[],
  cwd: string
) {
  const spawn = runtime.spawn ?? spawnSync;
  const result = spawn(command, [...args], { cwd, stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function helpText(config: CreateProgramConfig) {
  return `${config.name}

${config.description}

Usage:
  create-resumable <target> [--yes]

Options:
  --yes, -y          Use defaults
  --format <name>   node, bun, or deno
  --starter <name>  minimal, app, or full-stack
  --no-install      Skip dependency installation
  --no-git          Skip git initialization
  --force           Write into a non-empty directory
`;
}

function defaultRuntime(): ProgramRuntime {
  return {
    cwd: () => process.cwd(),
    env: process.env,
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    stdout: process.stdout,
    stderr: process.stderr,
    spawn: spawnSync
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const command = basename(process.argv[1] ?? "");
  const createArgs =
    command === "resumable" && args[0] === "create" ? args.slice(1) : args;
  const program = new CreateProgram();

  await program.run(createArgs);
}

function fileUrlPathname(url: string) {
  const pathname = decodePath(parseURL(url).pathname);
  const normalizedPathname = normalize(pathname);

  return normalizedPathname.replace(/^\/([A-Za-z]:\/)/, "$1");
}

function isEntrypoint(scriptPath: string | undefined, moduleUrl: string) {
  return (
    scriptPath !== undefined &&
    moduleUrl.startsWith("file:") &&
    normalize(resolve(scriptPath)) === fileUrlPathname(moduleUrl)
  );
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
  await runCli();
}
