import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

type PackageJson = {
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const rootDir = import.meta.dirname;
const workspacePath = (path: string) => resolve(rootDir, path);

const packageDirs = {
  core: workspacePath("libs/core"),
  cli: workspacePath("libs/cli")
};

const readPackageManifest = (packagePath: string): PackageJson =>
  JSON.parse(readFileSync(resolve(workspacePath(packagePath), "package.json"), "utf-8"));

const packageImportPattern = (packageName: string) =>
  new RegExp(`^${packageName.replaceAll("/", "\\/").replaceAll(".", "\\.")}(\\/.*)?$`);

const dependencyImportPatterns = (dependencies: Record<string, string> = {}) =>
  Object.keys(dependencies).map(packageImportPattern);

const externalPackageImports = (
  packagePath: string,
  options?: { devDependencies?: boolean }
) => {
  const pkg = readPackageManifest(packagePath);

  return [
    /^node:/,
    ...dependencyImportPatterns(pkg.dependencies),
    ...dependencyImportPatterns(pkg.peerDependencies),
    ...(options?.devDependencies ? dependencyImportPatterns(pkg.devDependencies) : [])
  ];
};

const buildDefaults = {
  format: "esm" as const,
  clean: ["lib/**/*", "dist/**/*"],
  outDir: "./lib"
};

const externalDependencies = (
  neverBundle: NonNullable<PackUserConfig["deps"]>["neverBundle"]
) =>
  ({
    neverBundle,
    onlyBundle: false
  }) satisfies NonNullable<PackUserConfig["deps"]>;

const coreBuild = {
  ...buildDefaults,
  name: "@resumable.dev/core",
  cwd: packageDirs.core,
  entry: {
    index: "./src/index.ts",
    vite: "./src/vite.ts"
  },
  root: "src",
  platform: "neutral",
  dts: false,
  deps: externalDependencies(externalPackageImports("libs/core")),
  outputOptions: {
    dir: "./lib",
    entryFileNames: "[name].mjs"
  }
} satisfies PackUserConfig;

const cliBuild = {
  ...buildDefaults,
  name: "create-resumable",
  cwd: packageDirs.cli,
  entry: {
    index: "./src/index.ts"
  },
  root: "src",
  platform: "node",
  dts: false,
  deps: externalDependencies(
    externalPackageImports("libs/cli", { devDependencies: true })
  ),
  define: {
    __VERSION__: JSON.stringify(readPackageManifest("libs/cli").version)
  },
  banner: "#!/usr/bin/env node",
  outputOptions: {
    dir: "./lib",
    entryFileNames: "index.mjs"
  }
} satisfies PackUserConfig;

const ignores = [
  ".git",
  "node_modules",
  "lib",
  "dist",
  ".output",
  ".nitro",
  ".vite",
  "fixtures/nitro-app/**",
  "fixtures/nitro-app/node_modules",
  "fixtures/nitro-app/.output"
];

export default defineConfig({
  pack: [coreBuild, cliBuild],
  fmt: {
    ignorePatterns: ignores,
    useTabs: false,
    tabWidth: 2,
    printWidth: 90,
    singleQuote: false,
    jsxSingleQuote: false,
    quoteProps: "preserve",
    trailingComma: "none",
    semi: true,
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: "lf"
  },
  lint: {
    ignorePatterns: ignores,
    plugins: ["typescript", "unicorn"],
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "warn"
    },
    rules: {
      "no-unused-vars": "error",
      "no-shadow-restricted-names": "off",
      "typescript/no-floating-promises": "error"
    }
  },
  test: {
    include: ["**/*.unit.ts", "**/*.unit.tsx"],
    exclude: ["**/node_modules/**", "**/lib/**", "**/dist/**"]
  },
  staged: {
    "*": "vp check --fix"
  }
});
