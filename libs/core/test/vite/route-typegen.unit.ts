import { describe, expect, it } from "vite-plus/test";
import {
  discoverPageFiles,
  type RouteTypegenDirent,
  type RouteTypegenFileSystem
} from "../../src/vite/route-typegen.ts";

describe("route typegen", () => {
  it("discovers .tsx and .mdx page files", async () => {
    const fs = mockRouteTypegenFs({
      "/project/pages": [
        dirent("index.tsx", "file"),
        dirent("about.mdx", "file"),
        dirent("ignored.md", "file"),
        dirent("docs", "directory")
      ],
      "/project/pages/docs": [dirent("[...slug].mdx", "file")]
    });

    await expect(discoverPageFiles(fs, "/project")).resolves.toEqual([
      "/pages/about.mdx",
      "/pages/docs/[...slug].mdx",
      "/pages/index.tsx"
    ]);
  });
});

function mockRouteTypegenFs(
  directories: Record<string, readonly RouteTypegenDirent[]>
): RouteTypegenFileSystem {
  return {
    async readdir(path) {
      const entries = directories[path];
      if (!entries) {
        throw Object.assign(new Error(`Not found: ${path}`), { code: "ENOENT" });
      }
      return [...entries];
    },
    async mkdir() {},
    async readFile() {
      throw Object.assign(new Error("Not found"), { code: "ENOENT" });
    },
    async writeFile() {}
  };
}

function dirent(name: string, kind: "directory" | "file"): RouteTypegenDirent {
  return {
    name,
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file"
  };
}
