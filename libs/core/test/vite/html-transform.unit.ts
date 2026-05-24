import { describe, expect, it } from "vite-plus/test";
import { parseAst } from "vite";
import { transformHtmlSource } from "../../src/vite/html-transform.ts";

describe("html transform", () => {
  it("appends html attribute helper from app.tsx root Html props", () => {
    const source = `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return (
    <Html lang="en" data-path={props.url.pathname} data-status={String(props.status)} data-resumable>
      <head />
      <body>
        <Slot />
      </body>
    </Html>
  );
});
`;

    const transformed = transform(source);

    expect(transformed).toContain("export default component$");
    expect(transformed).toContain(
      "export function __resumableHtmlAttributes(props: PageProps)"
    );
    expect(transformed).toContain('"lang": "en"');
    expect(transformed).toContain('"data-path": props.url.pathname');
    expect(transformed).toContain('"data-status": String(props.status)');
    expect(transformed).toContain('"data-resumable": true');
    expect(transformed).not.toContain("resumable-html");
    expect(transformed).not.toContain("stripQwikAttributes");
    expect(transformed).not.toContain("html.replace");
  });

  it("appends html attribute helper from app.jsx root Html props", () => {
    const source = `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$((props) => {
  return (
    <Html lang="en" data-path={props.url.pathname}>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
`;

    const transformed = transform(source, "jsx", "/project/app.jsx");

    expect(transformed).toContain("export function __resumableHtmlAttributes(props)");
    expect(transformed).toContain('"data-path": props.url.pathname');
  });

  it("rejects app.tsx when the default component root is not Html", () => {
    expect(() =>
      transform(
        `import { component$ } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$(() => {
  return <body />;
});
`
      )
    ).toThrow("Resumable expected app.tsx or app.jsx to return <Html> at the top level");
  });

  it("rejects Html attributes that capture render-time locals", () => {
    expect(() =>
      transform(
        `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$((props) => {
  const section = props.url.pathname.split("/")[1] || "home";

  return (
    <Html lang="en" data-section={section}>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
`
      )
    ).toThrow('Resumable cannot use "section" in <Html data-section={...}>');
  });

  it("rejects Html spread attributes", () => {
    expect(() =>
      transform(
        `import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$((props) => {
  return (
    <Html {...props.html}>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
`
      )
    ).toThrow("Resumable does not support spreading props onto <Html> yet");
  });
});

function transform(source: string, lang: "jsx" | "tsx" = "tsx", id = "/project/app.tsx") {
  return transformHtmlSource(
    source,
    parseAst(source, { astType: "ts", lang, range: true }, id)
  );
}
