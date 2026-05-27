import { describe, expect, it } from "vite-plus/test";
import { transformMdxRoute } from "../../src/vite/mdx.ts";

describe("resumable MDX transform", () => {
  it("rejects multiple Composed MDX content delimiters", async () => {
    await expect(
      transformMdxRoute(
        `<main><Content /></main>

--- content

# One

--- content

# Two
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("Composed MDX must contain exactly one --- content delimiter");
  });

  it("rejects Composed MDX without a Content slot", async () => {
    await expect(
      transformMdxRoute(
        `<main>No slot</main>

--- content

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("Composed MDX must contain exactly one visible <Content /> slot");
  });

  it("rejects Composed MDX with multiple Content slots", async () => {
    await expect(
      transformMdxRoute(
        `<main>
  <Content />
  <Content />
</main>

--- content

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("Composed MDX must contain exactly one visible <Content /> slot");
  });

  it("rejects Composed MDX imports that bind Content", async () => {
    await expect(
      transformMdxRoute(
        `import { Content } from "../components/Content";

<main><Content /></main>

--- content

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("Do not import or define Content");
  });

  it("rejects Composed MDX definitions named Content", async () => {
    await expect(
      transformMdxRoute(
        `export const Content = () => null;

<main><Content /></main>

--- content

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("Do not import or define Content");
  });

  it("rejects ESM below the Composed MDX content delimiter", async () => {
    await expect(
      transformMdxRoute(
        `<main><Content /></main>

--- content

import { Badge } from "../components/Badge";

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("ESM imports and exports must appear above --- content");
  });

  it("rejects frontmatter layout metadata", async () => {
    await expect(
      transformMdxRoute(
        `---
layout: ../layouts/DocsLayout.tsx
---

# Body
`,
        "/project/pages/docs.mdx"
      )
    ).rejects.toThrow("MDX frontmatter layout is not supported");
  });
});
