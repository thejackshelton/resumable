# Resumable Typed Routing Specification

Status: Draft

Parent spec: `SPEC.md`

Implementation owner: the `resumable()` Vite plugin from
`@resumable.dev/core/vite`.

## Decision

Resumable typed routing should use native HTML anchors as the primary authoring
API.

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

Resumable compiles those anchors to real HTML anchors:

```tsx
<a href="/blog/hello">Hello</a>
<a href="/docs/guides/getting-started">Getting Started</a>
```

No `Link` component is required for v0. No public `href()` helper is required
for v0.

Core rule:

```txt
Author links as normal <a> elements.
Let Resumable type-check and enhance them.
```

## Goals

- Keep navigation HTML-native.
- Make the route path obvious from the link source.
- Generate route types from `pages/`.
- Type-check native `<a href>`.
- Support dynamic and catch-all params without a public URL builder function.
- Compile route-pattern anchors to concrete href strings before they reach the
  DOM.
- Enhance same-origin anchors for SPA navigation.
- Preserve full document navigation when JavaScript is unavailable or disabled.

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

- A `Link` component.
- A public `href()` helper.
- A route object API.
- A generated route tree that users import manually.
- A Resumable config file.
- Type-safe form actions.
- Type-safe API route URLs.
- Type-safe arbitrary public asset URLs.
- Client-side data loaders.

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
- SvelteKit and Astro lean heavily on native anchors and enhance navigation
  behavior globally.
- Next.js supports typed routes for `Link` and router APIs, but does not make
  native anchors the primary typed API.
- TanStack Router has strong typed routing with `Link to` and `params`, but the
  API requires a router-specific component and route syntax.

Resumable should take the native-anchor direction from SvelteKit/Astro and add
the generated type safety and dynamic param ergonomics usually found in router
components.

## Route Type Generation

The `resumable()` Vite plugin scans the top-level `pages/` directory using the
same normalization rules as the main v0 spec.

Example input:

```txt
pages/index.tsx
pages/about.tsx
pages/blog/index.tsx
pages/blog/[slug].tsx
pages/docs/[...slug].tsx
```

Generated route model:

```ts
export type ResumableConcretePageHref =
  | "/"
  | "/about"
  | "/blog"
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

## JSX Type Augmentation

The Vite plugin should generate a physical `.d.ts` file that augments Qwik's
native anchor JSX type.

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

declare module "@qwik.dev/core" {
  namespace QwikJSX {
    interface IntrinsicElements {
      a: ResumableAnchorProps;
    }
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

Type generation alone is not enough for route-pattern anchors.

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

The `resumable()` Vite plugin must lower route-pattern anchors before Qwik
renders them.

Conceptual transform:

```tsx
<a href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</a>
```

becomes:

```tsx
<a href={__resumableHref("/blog/[slug]", { slug: post.slug })}>{post.title}</a>
```

`__resumableHref` is an internal helper. It is not a required public API.

Transform requirements:

- Only transform lowercase native `<a>` elements.
- Only transform anchors whose `href` is a string literal route pattern.
- Remove the `params` prop from the rendered DOM output.
- Preserve all normal anchor props such as `class`, `target`, `rel`,
  `aria-*`, `data-*`, and event handlers.
- Run before Qwik consumes/transforms TSX.
- Produce direct build errors for invalid route-pattern anchors when type
  checking is not running.

The transform should not modify concrete anchors:

```tsx
<a href="/about">About</a>
<a href={`/blog/${slug}`}>Blog</a>
```

Concrete anchors are already real hrefs.

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

## SPA Navigation

Resumable should enhance native same-origin anchors for SPA navigation.

This means users write:

```tsx
<a href="/about">About</a>
```

and Resumable handles client-side navigation when possible.

The navigation runtime should intercept a click only when:

- The href is same-origin.
- The href maps to a Resumable page route.
- The click is a normal primary-button click.
- No modifier key is pressed.
- The anchor does not have `download`.
- The anchor target is missing or `_self`.
- The anchor does not opt out with `data-resumable-reload`.
- The anchor does not opt out with `rel="external"`.

If any condition fails, the browser should handle the anchor normally.

Baseline behavior must still work without JavaScript because all authored links
compile to real HTML hrefs.

## Prefetching

Prefetching should use native anchor attributes rather than a `Link` component.

Proposed v0 attribute:

```tsx
<a href="/about" data-resumable-prefetch>
  About
</a>
```

Allowed values:

```txt
data-resumable-prefetch
data-resumable-prefetch="intent"
data-resumable-prefetch="viewport"
data-resumable-prefetch="false"
```

Default behavior should be conservative. Resumable should not prefetch every
link by default in v0 unless performance work proves that is safe.

## Relationship To Link

`Link` should not be the primary v0 navigation API.

If a `Link` component is added later, it should be a thin convenience over the
same typed anchor model, not a separate routing system.

Potential future shape:

```tsx
<Link href="/blog/[slug]" params={{ slug }}>
  Blog
</Link>
```

But v0 should first prove the native anchor direction.

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
- `pages/about.tsx` generates `/about`.
- `pages/blog/index.tsx` generates `/blog`.
- `pages/blog/[slug].tsx` generates `/blog/[slug]` and `/blog/${string}`.
- `pages/docs/[...slug].tsx` generates `/docs/[...slug]` and
  `/docs/${string}`.
- Generated types update when files are added, removed, or renamed in `pages/`.

Type checks:

- `<a href="/about">` is valid.
- `<a href="/missing">` is a type error.
- `<a href="/blog/[slug]" params={{ slug: "hello" }}>` is valid.
- `<a href="/blog/[slug]">` is a type error.
- `<a href="/blog/[slug]" params={{ id: "hello" }}>` is a type error.
- `<a href="/about" params={{ slug: "hello" }}>` is a type error.

Transform checks:

- Route-pattern anchors render concrete `href` values.
- The `params` prop never reaches the DOM.
- Static anchors are not rewritten.
- Dynamic params are URL-encoded as one segment.
- Catch-all params are URL-encoded segment-by-segment.

SPA checks:

- Same-origin page anchors are enhanced for client navigation.
- External anchors are not intercepted.
- `target="_blank"` anchors are not intercepted.
- `download` anchors are not intercepted.
- `data-resumable-reload` anchors are not intercepted.
- All links still work as normal browser navigation without JavaScript.

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
