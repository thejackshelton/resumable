import { describe, expect, it } from "vite-plus/test";
import { parseAst } from "vite";
import { __resumableHref } from "../../src/vite/entries/route-href.ts";
import { transformAnchorSource } from "../../src/vite/anchor-transform.ts";

const routePatterns = new Map([
  ["/blog/[slug]", [{ name: "slug", kind: "dynamic" }]],
  ["/docs/[...slug]", [{ name: "slug", kind: "catch-all" }]]
]);

describe("anchor transform", () => {
  it("lowers native route-pattern anchors and preserves normal props", () => {
    const source = `import { component$ } from "@qwik.dev/core";

export default component$(() => {
  const slug = "hello";

  return (
    <a class="post" href="/blog/[slug]" params={{ slug }} target="_self" aria-current="page" onClick$={() => {}}>
      Post
    </a>
  );
});
`;

    const transformed = transform(source);

    expect(transformed).toContain(
      'import { __resumableHref } from "virtual:resumable/route-href";'
    );
    expect(transformed).toContain(
      '<a class="post" href={__resumableHref("/blog/[slug]", { slug })} target="_self" aria-current="page" onClick$={() => {}}>'
    );
    expect(transformed).not.toContain("params=");
  });

  it("does not rewrite static anchors or expression hrefs", () => {
    const source = `export default () => {
  const slug = "hello";

  return (
    <nav>
      <a href="/about">About</a>
      <a href={\`/blog/\${slug}\`}>Blog</a>
    </nav>
  );
};
`;

    expect(transform(source)).toBe(source);
  });

  it("rejects route-pattern anchors that do not match pages", () => {
    expect(() =>
      transform(
        `export default () => <a href="/missing/[slug]" params={{ slug: "x" }} />;`
      )
    ).toThrow("Typed route error: /missing/[slug] does not match any route in pages/.");
  });

  it("rejects route-pattern anchors without params", () => {
    expect(() =>
      transform(`export default () => <a href="/blog/[slug]">Blog</a>;`)
    ).toThrow("Typed route error: /blog/[slug] requires params:\n- slug");
  });

  it("rejects route-pattern anchors with unknown object literal params", () => {
    expect(() =>
      transform(
        `export default () => <a href="/blog/[slug]" params={{ id: "hello" }} />;`
      )
    ).toThrow("Typed route error: /blog/[slug] does not define param:\n- id");
  });

  it("rejects route-pattern anchors with missing object literal params", () => {
    expect(() =>
      transform(`export default () => <a href="/blog/[slug]" params={{}} />;`)
    ).toThrow("Typed route error: /blog/[slug] requires params:\n- slug");
  });

  it("encodes dynamic and catch-all params", () => {
    expect(__resumableHref("/blog/[slug]", { slug: "hello world" })).toBe(
      "/blog/hello%20world"
    );
    expect(__resumableHref("/blog/[slug]", { slug: "a/b" })).toBe("/blog/a%2Fb");
    expect(__resumableHref("/docs/[...slug]", { slug: "guides/getting-started" })).toBe(
      "/docs/guides/getting-started"
    );
    expect(
      __resumableHref("/docs/[...slug]", {
        slug: ["guides", "getting started"]
      })
    ).toBe("/docs/guides/getting%20started");
  });

  it("rejects empty catch-all params", () => {
    expect(() => __resumableHref("/docs/[...slug]", { slug: "" })).toThrow(
      "Typed route error: /docs/[...slug] requires a non-empty catch-all param."
    );
    expect(() => __resumableHref("/docs/[...slug]", { slug: [] })).toThrow(
      "Typed route error: /docs/[...slug] requires a non-empty catch-all param."
    );
  });
});

function transform(source: string) {
  return transformAnchorSource(
    source,
    parseAst(source, { astType: "ts", lang: "tsx", range: true }, "/project/page.tsx"),
    routePatterns
  );
}
