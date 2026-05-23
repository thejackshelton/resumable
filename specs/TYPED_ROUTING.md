# Resumable Typed Routing Specification

Status: Draft

Parent spec: [`SPEC.md`](./SPEC.md)

Implementation owner: the `resumable()` Vite plugin from
`@resumable.dev/core/vite`.

## Decision

Resumable typed routing should use the same route prop model for native HTML
anchors and the Resumable `Link` component.

Native anchors are for typed platform navigation:

Static routes use normal concrete URLs:

```tsx
<a href="/">Home</a>
<a href="/about">About</a>
<a href="/blog">Blog</a>
```

Dynamic routes may use Resumable's file-route pattern syntax with a `params`
prop:

```tsx
<a href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</a>
```

Catch-all routes use the same file-route pattern syntax:

```tsx
<a href="/docs/[...slug]" params={{ slug: "guides/getting-started" }}>
  Getting Started
</a>
```

`Link` uses the same typed `href` and `params` API, but opts into Resumable SPA
navigation:

```tsx
import { Link } from "@resumable.dev/core";

<Link href="/about">About</Link>

<Link href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</Link>
```

Resumable compiles route-pattern anchors and links to real HTML hrefs:

```tsx
<a href="/blog/hello">Hello</a>
<a href="/docs/guides/getting-started">Getting Started</a>
```

No public `href()` helper is required for v0.

Core rule:

```txt
Use <a> for typed platform navigation.
Use Link for typed SPA navigation.
```

## Goals

- Keep navigation HTML-native.
- Make the route path obvious from the link source.
- Generate route types from `pages/`.
- Type-check native `<a href>`.
- Type-check `Link` with the same route model as native anchors.
- Support dynamic and catch-all params without a public URL builder function.
- Compile route-pattern anchors and links to concrete href strings before they
  reach the DOM.
- Keep native `<a>` as normal browser navigation.
- Use `Link` for SPA navigation, prefetching, scroll behavior, and future
  transition state.
- Preserve full document navigation for anchors and for `Link` when JavaScript
  is unavailable or disabled.

This should be optimized for junior developers and AI agents. The route pattern
in a dynamic link should look like the file that defined the route:

```txt
pages/blog/[slug].tsx
```

```tsx
<a href="/blog/[slug]" params={{ slug }}>
```

## Non-Goals

Typed routing v0 should not require:

- A public `href()` helper.
- A route object API.
- A generated route tree that users import manually.
- A Resumable config file.
- Type-safe form actions in this navigation spec. Progressive form mutations
  are owned by the data fetching spec.
- Type-safe API route URLs.
- Type-safe arbitrary public asset URLs.
- Client-side data loaders.
- Global click interception for every same-origin native anchor.

Those can be added later if implementation pressure proves they are needed.

## Research Baseline

Grep MCP research found these relevant patterns:

- Qwik exposes JSX intrinsic element types through `QwikJSX` and
  `IntrinsicElements`.
- Qwik's anchor JSX type is part of the intrinsic element surface, so native
  `<a>` typing can be influenced by framework types.
- Public Qwik projects augment Qwik JSX through module declarations.
- Solid Router augments native anchor attributes with router-specific props such
  as `replace`, `preload`, and `state`.
- SvelteKit and Astro lean heavily on native anchors and can enhance navigation
  behavior globally.
- Next.js supports typed routes for `Link` and router APIs, but does not make
  native anchors the primary typed API.
- TanStack Router has strong typed routing with `Link to` and `params`, but the
  API requires a router-specific component and route syntax.

Resumable should keep native anchors typed and platform-native, while providing
`Link` as the explicit SPA navigation surface. Both should share the same
generated route types and file-route pattern syntax.

## Route Type Generation

The `resumable()` Vite plugin scans the top-level `pages/` directory using the
same normalization rules as the main v0 spec.

Example input:

```txt
pages/index.tsx
pages/about.tsx
pages/docs.mdx
pages/blog/index.mdx
pages/blog/[slug].tsx
pages/docs/[...slug].mdx
```

Generated route model:

```ts
export type ResumableConcretePageHref =
  | "/"
  | "/about"
  | "/blog"
  | "/docs"
  | `/blog/${string}`
  | `/docs/${string}`;

export type ResumableRoutePattern = "/blog/[slug]" | "/docs/[...slug]";

export interface ResumableRouteParams {
  "/blog/[slug]": {
    readonly slug: string | number;
  };
  "/docs/[...slug]": {
    readonly slug: string | number | readonly (string | number)[];
  };
}
```

Static routes generate concrete string literals. Dynamic routes generate
template literal types. Catch-all routes generate template literal types whose
dynamic part may include slashes.

The generated type declaration should also include allowed non-page hrefs:

```ts
export type ResumableExternalHref =
  | `http://${string}`
  | `https://${string}`
  | `mailto:${string}`
  | `tel:${string}`
  | `#${string}`
  | `?${string}`;

export type ResumableAssetHref = `/${string}.${string}`;
```

`ResumableAssetHref` is intentionally broad because public assets are not UI
routes. It lets common links such as `/favicon.ico`, `/robots.txt`, and
`/images/logo.png` remain valid without making the page route type unsafe.

TSX and MDX page files generate the same route types. The route type generator
uses the main spec's normalization rules for all supported page extensions.

## JSX Type Augmentation

The Vite plugin should generate a physical `.d.ts` file that augments Qwik's
native anchor JSX type and supplies app-specific route props for Resumable's
`Link` component.

Proposed generated shape:

```ts
import type { PropsOf } from "@qwik.dev/core";

type BaseAnchorProps = Omit<PropsOf<"a">, "href" | "params">;

type RoutePatternAnchor = {
  [Pattern in ResumableRoutePattern]: BaseAnchorProps & {
    readonly href: Pattern;
    readonly params: ResumableRouteParams[Pattern];
  };
}[ResumableRoutePattern];

type ConcreteAnchor = BaseAnchorProps & {
  readonly href?: ResumableConcretePageHref | ResumableExternalHref | ResumableAssetHref;
  readonly params?: never;
};

export type ResumableAnchorProps = ConcreteAnchor | RoutePatternAnchor;

export type ResumableLinkProps = ResumableAnchorProps & {
  readonly prefetch?: boolean | "intent" | "viewport";
  readonly replace?: boolean;
  readonly scroll?: boolean;
  readonly reload?: boolean;
};

declare module "@qwik.dev/core" {
  namespace QwikJSX {
    interface IntrinsicElements {
      a: ResumableAnchorProps;
    }
  }
}

declare module "@resumable.dev/core" {
  interface ResumableGeneratedRoutes {
    readonly anchor: ResumableAnchorProps;
    readonly link: ResumableLinkProps;
  }
}
```

Expected type behavior:

```tsx
// Valid.
<a href="/about">About</a>

// Valid.
<a href="/blog/[slug]" params={{ slug: "hello" }}>
  Hello
</a>

// Type error: route does not exist.
<a href="/bog">Broken</a>

// Type error: params are required for this route pattern.
<a href="/blog/[slug]">Broken</a>

// Type error: wrong param name.
<a href="/blog/[slug]" params={{ id: "hello" }}>
  Broken
</a>

// Type error: static routes do not accept params.
<a href="/about" params={{ slug: "hello" }}>
  Broken
</a>

// Valid: Link uses the same route props and opts into SPA navigation.
<Link href="/blog/[slug]" params={{ slug: "hello" }}>
  Hello
</Link>
```

The generated declaration should be updated whenever `pages/` changes during
development and before production builds.

## Generated Files

Typed routing must work without users editing `tsconfig.json`.

Preferred generated files:

```txt
resumable-env.d.ts
.resumable/
  types/
    routes.d.ts
```

`resumable-env.d.ts` is a small root file similar to `next-env.d.ts`. It is not
configuration. It exists so TypeScript and editors can discover Resumable's
generated route types:

```ts
/// <reference path="./.resumable/types/routes.d.ts" />
```

`.resumable/types/routes.d.ts` is generated from `pages/` and may be ignored by
git.

If a project has a restrictive `tsconfig.json`, the CLI and docs should explain
that `resumable-env.d.ts` must be included by TypeScript.

## JSX Transform

Type generation alone is not enough for route-pattern anchors or links.

This source:

```tsx
<a href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</a>
```

must not render this HTML:

```html
<a href="/blog/[slug]" params="[object Object]">...</a>
```

The `resumable()` Vite plugin must lower route-pattern anchors and links before
Qwik renders them.

Conceptual anchor transform:

```tsx
<a href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</a>
```

becomes:

```tsx
<a href={__resumableHref("/blog/[slug]", { slug: post.slug })}>{post.title}</a>
```

Conceptual Link transform:

```tsx
<Link href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</Link>
```

becomes:

```tsx
<Link href={__resumableHref("/blog/[slug]", { slug: post.slug })}>{post.title}</Link>
```

`__resumableHref` is an internal helper. It is not a required public API.

Transform requirements:

- Transform lowercase native `<a>` elements and Resumable `Link` components.
- Only transform elements whose `href` is a string literal route pattern.
- Remove the `params` prop from the rendered DOM output.
- Preserve all normal anchor props such as `class`, `target`, `rel`,
  `aria-*`, `data-*`, and event handlers.
- Preserve `Link` SPA props such as `prefetch`, `replace`, `scroll`, and
  `reload` for the `Link` runtime.
- Run before Qwik consumes/transforms TSX.
- Produce direct build errors for invalid route-pattern anchors when type
  checking is not running.

The transform should not modify concrete anchors or links:

```tsx
<a href="/about">About</a>
<a href={`/blog/${slug}`}>Blog</a>
<Link href="/about">About</Link>
```

Concrete anchors and links are already real hrefs.

## Param Encoding

Dynamic segment params are encoded as a single URL segment:

```tsx
<a href="/blog/[slug]" params={{ slug: "hello world" }}>
```

renders:

```html
<a href="/blog/hello%20world"></a>
```

If a dynamic segment contains `/`, it is encoded:

```tsx
<a href="/blog/[slug]" params={{ slug: "a/b" }}>
```

renders:

```html
<a href="/blog/a%2Fb"></a>
```

Catch-all params may be passed as a slash-joined string:

```tsx
<a href="/docs/[...slug]" params={{ slug: "guides/getting-started" }}>
```

or as an array:

```tsx
<a href="/docs/[...slug]" params={{ slug: ["guides", "getting-started"] }}>
```

Both render:

```html
<a href="/docs/guides/getting-started"></a>
```

Catch-all params are encoded segment-by-segment. Empty catch-all values are
invalid because catch-all routes match one or more remaining URL segments in
the main v0 routing spec.

## Link And SPA Navigation

Resumable should use `Link` for SPA navigation.

Native anchors stay native:

```tsx
<a href="/about">About</a>
```

They are type-checked and route-pattern anchors are compiled to real hrefs, but
they use normal browser navigation.

`Link` opts into client-side navigation:

```tsx
import { Link } from "@resumable.dev/core";

<Link href="/about">About</Link>

<Link href="/blog/[slug]" params={{ slug }}>
  Blog
</Link>
```

`Link` should render a real `<a>` so baseline behavior still works without
JavaScript.

The `Link` navigation runtime should intercept a click only when:

- The resolved href is same-origin.
- The resolved href maps to a Resumable page route.
- The click is a normal primary-button click.
- No modifier key is pressed.
- The rendered anchor does not have `download`.
- The rendered anchor target is missing or `_self`.
- The link does not opt out with `reload`.
- The rendered anchor does not have `rel="external"`.

If any condition fails, the browser should handle the anchor normally.

## Prefetching

Prefetching belongs on `Link`, not native anchors.

Proposed v0 API:

```tsx
<Link href="/about" prefetch="intent">
  About
</Link>
```

Allowed values:

```txt
prefetch={true}
prefetch="intent"
prefetch="viewport"
prefetch={false}
```

Default behavior should be conservative. Resumable should not prefetch every
link by default in v0 unless performance work proves that is safe.

Detailed prefetching behavior is being explored in
[`PREFETCHING_DRAFT.md`](./PREFETCHING_DRAFT.md). That file is not an
implementation contract.

## Relationship To href()

A public `href()` helper is not required in v0.

Resumable may use an internal href resolver as the output of the JSX transform.
That does not imply a public URL builder API.

A public URL builder can be added later for non-anchor contexts such as
canonical links, redirects, form actions, and API URLs if the absence of one
becomes painful.

## Error Messages

Errors should be direct and tied to the route file convention.

Missing param:

```txt
Typed route error: /blog/[slug] requires params:
- slug

Found:
<a href="/blog/[slug]">
```

Unknown param:

```txt
Typed route error: /blog/[slug] does not define param:
- id

Expected:
- slug
```

Unknown route:

```txt
Typed route error: /bog does not match any route in pages/.
```

Unsupported catch-all value:

```txt
Typed route error: /docs/[...slug] requires a non-empty catch-all param.
```

## Acceptance Criteria

Type generation:

- `pages/index.tsx` generates `/`.
- `pages/docs.mdx` generates `/docs`.
- `pages/about.tsx` generates `/about`.
- `pages/blog/index.mdx` generates `/blog`.
- `pages/blog/[slug].tsx` generates `/blog/[slug]` and `/blog/${string}`.
- `pages/docs/[...slug].mdx` generates `/docs/[...slug]` and
  `/docs/${string}`.
- Generated types update when files are added, removed, or renamed in `pages/`.

Type checks:

- `<a href="/about">` is valid.
- `<a href="/missing">` is a type error.
- `<a href="/blog/[slug]" params={{ slug: "hello" }}>` is valid.
- `<a href="/blog/[slug]">` is a type error.
- `<a href="/blog/[slug]" params={{ id: "hello" }}>` is a type error.
- `<a href="/about" params={{ slug: "hello" }}>` is a type error.
- `<Link href="/about">` is valid.
- `<Link href="/missing">` is a type error.
- `<Link href="/blog/[slug]" params={{ slug: "hello" }}>` is valid.
- `<Link href="/blog/[slug]">` is a type error.

Transform checks:

- Route-pattern anchors render concrete `href` values.
- Route-pattern links render concrete `href` values.
- The `params` prop never reaches the DOM.
- Static anchors are not rewritten.
- Static links are not rewritten.
- Dynamic params are URL-encoded as one segment.
- Catch-all params are URL-encoded segment-by-segment.

SPA checks:

- Native `<a>` elements use normal browser navigation.
- Same-origin page `Link` clicks are enhanced for client navigation.
- External `Link` hrefs are not intercepted.
- `target="_blank"` links are not intercepted.
- `download` links are not intercepted.
- `reload` links are not intercepted.
- All anchors and links still work as normal browser navigation without
  JavaScript.

## Open Questions

- Should the public asset href type stay broad with `/${string}.${string}`, or
  should Resumable scan `public/` and generate exact asset hrefs later?
- Should route-pattern anchors support query strings and hashes directly, such
  as `/blog/[slug]?tab=comments#top`?
- Should `params` accept booleans, dates, or only strings and numbers?
- Should a future public URL builder be added for redirects, canonical links,
  form actions, and API URLs?
- Should `resumable-env.d.ts` be committed like `next-env.d.ts`, or should it
  remain generated-only?
