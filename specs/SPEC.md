# Resumable v0 Specification

Status: Draft

## Positioning

Name: Resumable

Descriptor: A minimal Qwik meta-framework for Vite, powered by Nitro.

Domain: `resumable.dev`

Core package: `@resumable.dev/core`

Primary category: Qwik meta-framework.

Resumable should not be described as an AI framework or AI meta-framework in
primary positioning. AI examples can exist as demos or proof-of-concept apps,
but AI is not the category.

Short description:

> Resumable is a minimal Qwik + Nitro framework where `pages/` maps to routes,
> `api/` maps to Nitro API routes, layouts are normal components, middleware is
> Nitro-native, configuration lives in `vite.config.ts`, and generated apps use
> Vite+ for the local command surface.

Even shorter mental model:

- Pages are Resumable.
- Components are Qwik.
- Server behavior is Nitro.
- Configuration is Vite.
- Tooling is Vite+.

## Framework Boundary

Resumable should hide Nitro wiring, but it should not hide Nitro itself.

`resumable()` owns the framework glue needed to turn Qwik page modules into a
Nitro-powered app: page scanning, route manifest generation, Qwik rendering,
top-level middleware wiring, public asset behavior, and the internal Nitro page
renderer. A standard Resumable app should not require users to install or call
Nitro's Vite plugin directly.

When an app needs server behavior, the answer should usually be Nitro-native:
use Nitro API routes, Nitro middleware, Nitro route rules, Nitro runtime config,
Nitro storage, Nitro caching, Nitro deployment presets, and Nitro plugins.
Resumable should not create aliases for Nitro concepts unless there is a clear
Qwik-specific product reason.

Canonical ownership:

```txt
pages/       -> Resumable UI routes
components/  -> Qwik component tree
api/         -> Nitro API routes
middleware/  -> Nitro request pipeline
public/      -> Nitro public assets
nitro: {}    -> native Nitro app config
vite.config  -> single app configuration surface
Vite+        -> generated app command surface
```

This keeps the beginner path small while preserving an honest escape hatch for
real applications. Users should be able to build the first page without
learning Nitro, but when they search for deployment, rewrites, route rules,
runtime config, storage, or server middleware, the documented answer should use
Nitro's real names and link to Nitro's docs.

## Research Baseline

The existing `fixtures/nitro-app` proves that Qwik and Nitro v3 can work
together through Vite. The fixture combines:

- Nitro's Vite plugin from `nitro/vite`.
- Qwik's Vite plugin.
- A server entry that uses Qwik `renderToString`.
- Nitro asset collection through `?assets=client` and `?assets=ssr`.

Nitro v3 research confirms the framework should lean on Nitro rather than
inventing parallel server concepts:

- Nitro integrates with Vite through `nitro()` and accepts native Nitro config
  in the top-level `nitro` key of `vite.config.ts`.
- Nitro supports filesystem routing for `api/` and `routes/`, plus
  programmatic route registration through `routes` and `handlers`.
- Nitro middleware is auto-registered from `middleware/` under the configured
  server directory, runs before route handlers, and executes in filename sort
  order.
- Nitro route rules support route-level behavior such as headers, redirects,
  proxying, CORS, caching, prerendering, and basic auth.
- Nitro's renderer and server-entry model are designed for framework SSR and
  custom HTML responses.
- Nitro serves `public/` assets and copies them into `.output/public` during
  production builds.
- Nitro's top-level `api/` directory maps to `/api/*` server routes.

Grep MCP sampling of public repositories also shows active Vite-based
frameworks and examples using `nitro()` alongside framework Vite plugins, and
using top-level `nitro: {}` in `vite.config.ts` for native Nitro config.
Nitro's Vite plugin also accepts a small plugin-specific config surface for
Vite integration internals, but ordinary app-level Nitro config belongs in the
top-level `nitro` key.

## Goals

Resumable v0 should provide the smallest useful Qwik + Nitro app model:

- Normal Qwik Vite plugin usage.
- One Resumable Vite plugin: `resumable()`.
- A top-level `pages/` directory for UI routes.
- A top-level `api/` directory for Nitro-native API routes.
- Optional top-level `document.tsx` for the global document shell.
- Qwik components as page modules.
- Explicit layout components imported by pages.
- Typed native anchors for platform navigation.
- A typed `Link` component for SPA navigation.
- Top-level `middleware/` that maps to Nitro middleware semantics.
- Resumable-owned Nitro plugin wiring.
- Native app-level Nitro configuration under the top-level Vite `nitro` key.
- Hard build errors for ambiguous routing.
- Root status pages for 404 and 500 UI.
- No framework config file.

The v0 experience should be obvious to junior developers and reliable for AI
agents editing a codebase. The URL should be readable from the file path.

## Non-Goals

Resumable v0 should not include:

- `src/pages/` as a required or canonical route directory.
- `resumable.config.ts`.
- `nitro.config.ts` as the documented app config path.
- Special layout files such as `pages/layout.tsx`.
- Frontmatter-assigned layouts such as `layout: ../layouts/DocsLayout`.
- Nested status pages such as `pages/blog/404.tsx` or `pages/blog/404.mdx`.
- Generic error route files such as `pages/_error.tsx`, `pages/+error.tsx`,
  `pages/error.tsx`, `pages/not-found.tsx`, or `pages/global-error.tsx`.
- API routes inside the UI page tree, such as `pages/api/hello.ts`.
- Top-level `routes/` as a documented or canonical app directory.
- Alternative document shell files such as legacy app-named document files,
  `root.tsx`, `shell.tsx`, `pages/document.tsx`, or `pages/_document.tsx`.
- Page-local middleware files such as `pages/blog/middleware.ts`.
- A new server runtime abstraction over Nitro.
- A wrapper over Qwik's Vite plugin or Qwik compiler options.
- AI-specific framework primitives.
- A data-loading API unless it is added intentionally after the route contract
  is stable.

## Canonical App Shape

```txt
my-app/
  document.tsx

  pages/
    index.mdx
    404.tsx
    500.tsx
    about.tsx
    docs.mdx
    blog/
      index.tsx
      test.tsx
      [slug].tsx
    docs/
      [...slug].mdx

  api/
    health.ts
    users/
      [id].get.ts

  middleware/
    00.logger.ts
    10.auth.ts

  components/
    docs/
      Sidebar.tsx
      DocsAside.tsx
    layouts/
      RootLayout.tsx
      MarketingLayout.tsx
      DocsLayout.tsx

  public/
  vite.config.ts
  package.json
```

The following files and folders are not required:

```txt
document.tsx
src/pages/
pages/api/
routes/
resumable.config.ts
nitro.config.ts
```

## Package API

The public Vite entrypoint is:

```ts
import { resumable } from "@resumable.dev/core/vite";
```

The public core entrypoint exposes the framework-aware document component and
shared runtime types:

```ts
import { Html, Link } from "@resumable.dev/core";
import type { PageProps } from "@resumable.dev/core";
```

The canonical Vite config is:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],

  nitro: {
    // Native Nitro v3 config.
  }
});
```

API boundary:

```txt
qwik()       -> Qwik compiler, optimizer, and resumability transforms
resumable()  -> pages/, route manifest, Nitro renderer, and middleware glue
nitro: {}    -> native app-level Nitro config
```

Do not nest Nitro config inside the Resumable plugin:

```ts
export default defineConfig({
  plugins: [
    resumable({
      nitro: {}
    })
  ]
});
```

Use the top-level Vite config instead:

```ts
export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {}
});
```

`resumable()` is responsible for Resumable's framework wiring and should install
Nitro's Vite plugin internally. A user should not need to add Nitro's Vite
plugin separately in a standard Resumable app.

Qwik remains explicit. Users should configure Qwik through Qwik's own Vite
plugin rather than through Resumable.

## Routing

Resumable uses a top-level `pages/` directory.

Route files are `.tsx` or `.mdx` files. Every route file in `pages/` maps
mechanically to a URL. `index.tsx` and `index.mdx` map to the current folder
root.

Required v0 mappings:

```txt
pages/index.tsx          -> /
pages/index.mdx          -> / if pages/index.tsx is absent
pages/404.tsx            -> unmatched page requests, status 404
pages/404.mdx            -> unmatched page requests, status 404
pages/500.tsx            -> unhandled page rendering errors, status 500
pages/500.mdx            -> unhandled page rendering errors, status 500
pages/about.tsx          -> /about
pages/docs.mdx           -> /docs
pages/blog/index.tsx     -> /blog
pages/blog/test.tsx      -> /blog/test
pages/blog/[slug].tsx    -> /blog/:slug
pages/docs/[...slug].mdx -> /docs/**
```

Prefer this:

```txt
pages/
  index.tsx
  about.tsx
  blog/
    index.tsx
    [slug].tsx
```

Over this:

```txt
pages/
  page.tsx
  about/
    page.tsx
```

Reason: the URL is obvious from the file path. This is better for junior
developers and AI agents.

`pages/404.tsx`, `pages/404.mdx`, `pages/500.tsx`, and `pages/500.mdx` are
special root status pages. They are not normal URL routes and should not be
linked as `/404` or `/500` in the route manifest.

MDX route files are first-class pages, not a separate content collection or
adapter system. Use `.tsx` for full Qwik page modules and `.mdx` for
documentation/content pages that can include Qwik components.

Plain `.md` route files are deferred in v0. Use `.mdx` for Markdown-style page
content so every page module compiles to the same Qwik component shape.

### Route Modules

A page module must default export a Qwik component. The default export is the
page entry component for that route.

```tsx
import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return <h1>Home</h1>;
});
```

Named component exports are allowed, but they are normal Qwik components and
helpers, not route entries. Resumable only treats the route module's default
export as the page.

```tsx
import { component$ } from "@qwik.dev/core";

export const AboutHero = component$(() => {
  return <h1>About</h1>;
});

export default component$(() => {
  return (
    <main>
      <AboutHero />
    </main>
  );
});
```

Do not add a Resumable-specific route component wrapper in v0:

```tsx
export default routeComponent$(() => {
  return <h1>Home</h1>;
});
```

Core rule:

```txt
The route is defined by the file path.
The page entry is the default export.
The component primitive remains Qwik's component$().
```

A route module can contain multiple components. The file path and default export
identify the route; named exports have no routing meaning in v0.

### MDX Route Modules

MDX route modules use the same file-path routing rules as TSX route modules:

```txt
pages/docs/index.mdx           -> /docs
pages/docs/getting-started.mdx -> /docs/getting-started
pages/blog/[slug].mdx          -> /blog/:slug
pages/docs/[...slug].mdx       -> /docs/**
```

An MDX route must compile to a default-exported Qwik component. Users should not
need to install or configure an MDX adapter in `vite.config.ts`.

MDX pages that need layout should use Composed MDX. Composed MDX keeps layout
as normal component composition: the top of the file defines the component tree,
and the content body renders where `<Content />` appears.

Example:

```mdx
import { Sidebar } from "../../components/docs/Sidebar";
import { DocsAside } from "../../components/docs/DocsAside";
import { DocsLayout } from "../../components/layouts/DocsLayout";

<DocsLayout section="guides">
  <Sidebar active="getting-started" />
  <main>
    <Content />
  </main>
  <DocsAside />
</DocsLayout>

--- content

# Getting Started

Resumable pages can be written in TSX or MDX.
```

Core rule:

```txt
TSX and MDX are both page modules.
The route is still defined by the file path.
The UI tree is still defined by the component tree.
Layouts are components.
The MDX content body is inserted explicitly at <Content />.
```

Composed MDX terms:

```txt
Composed MDX      -> the feature
component tree    -> the JSX above `--- content`
content body      -> the MDX below `--- content`
<Content />       -> the explicit content slot
```

The `--- content` delimiter is Resumable syntax, not native MDX syntax.
Resumable must split and normalize Composed MDX before calling the internal MDX
compiler.

Composed MDX rules:

- An MDX file becomes Composed MDX when it contains the `--- content`
  delimiter.
- The delimiter must be exactly `--- content`.
- The delimiter must start at column 1.
- A Composed MDX file must contain exactly one delimiter. Multiple delimiters
  are a direct error.
- The section above the delimiter may contain ESM imports/exports, comments,
  and one JSX component tree.
- The component tree above the delimiter must contain exactly one `<Content />`.
- `<Content />` is a reserved slot in the component tree, not a user component.
- The content body below the delimiter may contain normal Markdown, MDX JSX,
  and expressions supported by the internal MDX compiler.
- ESM imports and exports should appear above the delimiter.
- A plain MDX route without `--- content` compiles as a normal MDX page module.
- Astro-style `layout` frontmatter must not create a layout wrapper.

Do not add MDX-specific route hooks or content hooks in v0:

```txt
useContent()
useFrontmatter()
useTableOfContents()
```

Do not add side-channel content conventions in v0:

```txt
menu.md
docs.config.ts
content/
collections/
```

If frontmatter is supported, it should be parsed internally or exposed as normal
module metadata later. It must not create implicit layouts or implicit routes in
v0.

The `resumable()` Vite plugin owns MDX routing, Composed MDX normalization, and
MDX compilation. Satteri is the preferred internal compiler candidate because it
provides `mdxToJs()`, MDAST/HAST plugin hooks, and static optimization, but it
is not a public Resumable API. A fixture must prove Satteri output can be
normalized into Qwik v2-compatible modules before this implementation choice is
locked.

The internal MDX plugin should run before Qwik's Vite plugin consumes the
module, so Qwik sees ordinary Qwik-compatible component code.

### Page Props

Resumable passes route data to the route module default export as `PageProps`.
This is not a server component model; it is a normal Qwik component rendered by
Resumable's Qwik SSR renderer.

```tsx
import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return <h1>{props.params.slug}</h1>;
});
```

`PageProps` should be annotated on the props argument, not on `component$`.

Prefer this:

```tsx
export default component$((props: PageProps) => {
  return <h1>{props.params.slug}</h1>;
});
```

Over this:

```tsx
export default component$<PageProps>(({ params }) => {
  return <h1>{params.slug}</h1>;
});
```

Reason: `component$()` stays visually and conceptually Qwik-owned, while
`PageProps` is the Resumable page input.

Required v0 type shape:

```ts
export interface PageProps<Params extends object = Readonly<Record<string, string>>> {
  readonly params: Readonly<Params>;
  readonly url: {
    readonly href: string;
    readonly pathname: string;
    readonly search: string;
  };
  readonly status: number;
}
```

The Resumable TypeScript language service plugin should provide route-specific
`PageProps` for unannotated default page components. For example,
`pages/blog/[slug].tsx` receives `PageProps<{ readonly slug: string }>` in the
editor. Top-level `document.tsx` receives a document-wide `PageProps` shape with
params collected from every page route, marked optional because the document can
render any route.

`url` must be serializable page data, not a live `URL` instance. For normal
matched pages, `props.status` is `200`. For `pages/404.tsx` or `pages/404.mdx`,
it is `404`. For `pages/500.tsx` or `pages/500.mdx`, it is `500`.

For `pages/blog/[slug].tsx`, the page reads:

```tsx
export default component$((props: PageProps) => {
  return <h1>{props.params.slug}</h1>;
});
```

For `pages/users/[id].tsx`, the page reads:

```tsx
export default component$((props: PageProps) => {
  return <h1>User {props.params.id}</h1>;
});
```

For `pages/docs/[...slug].tsx`, the page reads:

```tsx
export default component$((props: PageProps) => {
  return <h1>{props.params.slug}</h1>;
});
```

For `GET /docs/guides/getting-started`, `props.params.slug` is:

```txt
guides/getting-started
```

Only the default export receives `PageProps`. Nested components and layouts
receive params explicitly through normal props.

```tsx
import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";
import { DocsLayout } from "../../components/layouts/DocsLayout";

export default component$((props: PageProps) => {
  return (
    <DocsLayout section={props.params.slug}>
      <h1>{props.params.slug}</h1>
    </DocsLayout>
  );
});
```

Do not make a route params hook the primary v0 API. If a `useParams()` helper is
added later, it should be a convenience for deeply nested components, not the
core page contract.

Framework-owned named exports are reserved for future features. v0 should not
require page metadata, route loaders, actions, or static params. Normal named
component and helper exports are allowed.

## Document Shell

Resumable supports an optional top-level `document.tsx` for the global document
shell.

```txt
my-app/
  document.tsx
  pages/
    index.tsx
```

`document.tsx` is not a route. It wraps every rendered page. If it is missing,
Resumable uses a built-in default document shell.

`document.tsx` must default export a Qwik component. The component should render
`Html` from `@resumable.dev/core` as the document boundary. `Html` accepts
normal Qwik `<html>` props.

The default document shell is conceptually:

```tsx
import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$(() => {
  return (
    <Html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
```

A custom document shell can import global CSS, add providers, customize `<head>`,
customize `<html>`, customize `<body>`, and render the selected page through
`<Slot />`:

```tsx
import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";
import type { PageProps } from "@resumable.dev/core";
import "./global.css";

export default component$((props: PageProps) => {
  const section = props.url.pathname.split("/")[1] || "home";

  return (
    <Html lang="en" data-section={section}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body class={section === "docs" ? "docs" : "default"} data-status={props.status}>
        <Slot />
      </body>
    </Html>
  );
});
```

`document.tsx` receives the same `PageProps` shape as route modules, so
route-specific document behavior is expressed from route context:

```tsx
import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return (
    <Html lang="en" data-path={props.url.pathname}>
      <head />
      <body data-status={props.status} data-path={props.url.pathname}>
        <Slot />
      </body>
    </Html>
  );
});
```

Why `Html` exists:

- Qwik's SSR renderer owns the outer application container, usually the
  `<html>` element, and applies Qwik-required container attributes during SSR.
- A plain lowercase `<html>` in user JSX would suggest that the app fully owns
  that container, which is not true for a resumable Qwik document.
- A hidden named export such as `htmlAttributes` is harder for junior developers
  and AI agents to discover.
- `Html` gives users the document-shaped API they expect while making the
  framework boundary visible in code.

`Html` is not the function that calls Qwik SSR. The internal Nitro renderer
still calls Qwik `renderToStream()` or `renderToString()`. `Html` is the public
document component that lets Resumable translate user-authored `<html>`
attributes into Qwik's container model and preserve framework-required Qwik
attributes.

Implementation note: `Html` should be typed from Qwik's intrinsic `<html>`
props, such as `PropsOf<"html">`, while Resumable normalizes the serializable
attributes it passes to Qwik SSR. Framework-required Qwik container attributes
always win over user attributes if names conflict.

Core rule:

```txt
document.tsx defines the global document shell through Html.
pages/ defines route UI.
components/ defines reusable layouts and UI.
```

Only support the top-level `document.tsx` and `document.jsx` names in v0.

Do not add aliases, including legacy app-named document files:

```txt
root.tsx
shell.tsx
pages/document.tsx
pages/_document.tsx
```

Reason: `document.tsx` names the thing users are editing: the HTML document. It
is not route-tree-specific, and it is still broad enough for global CSS,
providers, analytics, `<html>`, `<head>`, and `<body>` customization. `root.tsx`
conflicts with common `RootLayout` component naming, and `shell.tsx` is more
commonly used for ordinary UI components.

## Document Head

Resumable v0 does not include a route-local `Head` component. The document
shell owns `<head>` directly through normal JSX in `document.tsx`.

Use `props.url`, `props.params`, `props.status`, and ordinary functions to
customize the document per request:

```tsx
import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  const title = props.url.pathname === "/about" ? "About" : "Resumable";

  return (
    <Html lang="en">
      <head>
        <title>{title}</title>
        <meta name="description" content="Apps humans and agents can read." />
      </head>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
```

Core rule:

```txt
document.tsx owns the base document with Html, <head>, and <body>.
pages/ owns route UI.
```

Reasoning:

- `document.tsx` makes the document owner obvious to junior developers and AI
  agents.
- Users edit normal `<head>` tags instead of learning a new metadata schema.
- There is no render-time head collection, no request-scoping state, and no
  transform needed for arbitrary components inside a route-local head block.
- Route-local metadata can be added later if real apps prove the need.

Do not add framework-owned page metadata APIs in v0:

```tsx
<Head />;
export const head = {};
export const metadata = {};
```

The base `<head>` in `document.tsx` should contain document-wide defaults such as
`charset`, viewport, favicon, global styles, analytics tags, and static site
metadata. Route-specific document concerns in v0 should be expressed by
branching from `PageProps` in `document.tsx`.

## Navigation

Resumable v0 has two navigation surfaces that share the same generated route
types.

Use native anchors for typed platform navigation:

```tsx
<a href="/about">About</a>

<a href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</a>
```

Use `Link` for typed SPA navigation:

```tsx
import { Link } from "@resumable.dev/core";

<Link href="/about">About</Link>

<Link href="/blog/[slug]" params={{ slug: post.slug }}>
  {post.title}
</Link>
```

Core rule:

```txt
<a> is typed and platform-native.
Link is typed and SPA-capable.
```

The `resumable()` Vite plugin owns route type generation and JSX lowering for
route-pattern `href` values with `params`. Native anchors should not be globally
intercepted for SPA navigation. `Link` is the explicit SPA navigation surface.

The detailed typed routing and navigation contract lives in
`./TYPED_ROUTING.md`.

### Dynamic And Catch-All Routes

Single dynamic segments use `[param]` before a supported page extension and
match exactly one URL segment:

```txt
pages/blog/[slug].tsx -> /blog/:slug
pages/blog/[slug].mdx -> /blog/:slug
```

Catch-all segments use `[...param]` before a supported page extension and match
one or more remaining URL segments:

```txt
pages/docs/[...slug].tsx -> /docs/**
pages/docs/[...slug].mdx -> /docs/**
```

Catch-all params are exposed through `PageProps.params` as slash-joined strings,
matching Nitro and SolidStart behavior:

```txt
GET /docs/guides/getting-started
props.params.slug === "guides/getting-started"
```

Catch-all routes do not match the folder root. Use `index.tsx` or `index.mdx`
for the folder root:

```txt
pages/docs/index.tsx     -> /docs
pages/docs/index.mdx     -> /docs
pages/docs/[...slug].tsx -> /docs/**
pages/docs/[...slug].mdx -> /docs/**
```

This keeps index files mechanically tied to the current folder root and avoids
undefined or array route params in the v0 `PageProps` type.

Catch-all segments must be the final route segment in v0.

Supported:

```txt
pages/[...slug].tsx
pages/[...slug].mdx
pages/docs/[...slug].tsx
pages/docs/[...slug].mdx
```

Unsupported in v0:

```txt
pages/docs/[...slug]/edit.tsx
pages/[...lang]/[...slug].tsx
pages/docs/[[...slug]].tsx
```

### Route Normalization

Route conflict detection should normalize routes before comparison:

- Remove the `pages/` prefix.
- Remove supported page extensions: `.tsx` and `.mdx`.
- Convert trailing `/index` to the current folder root.
- Convert `[param]` segments to dynamic URL segments.
- Convert `[...param]` final segments to catch-all URL segments.
- Ignore the dynamic parameter name for conflict identity.
- Ignore the catch-all parameter name for conflict identity.
- Normalize trailing slashes away except for `/`.

Examples:

```txt
pages/blog.tsx            -> /blog
pages/blog.mdx            -> /blog
pages/blog/index.tsx      -> /blog
pages/blog/index.mdx      -> /blog
pages/blog/[id].tsx       -> /blog/:param
pages/blog/[slug].tsx     -> /blog/:param
pages/blog/[slug].mdx     -> /blog/:param
pages/docs/[...path].tsx  -> /docs/**
pages/docs/[...slug].tsx  -> /docs/**
pages/docs/[...slug].mdx  -> /docs/**
```

`pages/blog/[id].tsx` and `pages/blog/[slug].tsx` conflict because both match
the same URL shape.

`pages/docs/[...path].tsx` and `pages/docs/[...slug].tsx` conflict because both
match the same URL shape.

Static and dynamic siblings are allowed when their normalized route shapes are
different:

```txt
pages/blog/test.tsx       -> /blog/test
pages/blog/[slug].tsx     -> /blog/:param
pages/blog/[...slug].tsx  -> /blog/**
```

The runtime matcher must prefer static routes over dynamic routes, and dynamic
routes over catch-all routes.

### Route Conflicts

Conflicts are hard build errors.

Example conflict:

```txt
pages/blog.tsx
pages/blog/index.tsx
pages/blog.mdx
```

Both map to:

```txt
/blog
```

Error:

```txt
Route conflict: /blog is defined by both:
- pages/blog.tsx
- pages/blog/index.tsx
- pages/blog.mdx

Choose one.
```

The error must name the URL and the exact files. It should not be a generic Vite
or Nitro error.

### Status Pages

Resumable v0 supports root status pages as TSX or MDX:

```txt
pages/404.tsx
pages/404.mdx
pages/500.tsx
pages/500.mdx
```

Status pages are normal page modules with a default export after compilation:

```tsx
import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return <h1>Page not found: {props.url.pathname}</h1>;
});
```

`pages/404.tsx` or `pages/404.mdx` renders unmatched page requests with HTTP
status 404.

`pages/500.tsx` or `pages/500.mdx` renders unhandled errors thrown while
matching or rendering a Resumable page with HTTP status 500.

If `pages/404.tsx` and `pages/404.mdx` are missing, Resumable renders a minimal
built-in 404 page. If `pages/500.tsx` and `pages/500.mdx` are missing,
Resumable renders a minimal built-in 500 page.

If the user-defined 500 page itself fails to render, Resumable must fall back to
Nitro's native error response rather than recursively attempting to render the
500 page.

Status page props use the same `PageProps` type. For unmatched page requests,
`props.params` is empty and `props.url` describes the original requested URL.

The v0 status page convention is intentionally root-only:

```txt
pages/404.tsx        supported
pages/404.mdx        supported
pages/500.tsx        supported
pages/500.mdx        supported
pages/blog/404.tsx   unsupported in v0
pages/blog/404.mdx   unsupported in v0
pages/blog/500.tsx   unsupported in v0
pages/blog/500.mdx   unsupported in v0
```

Do not add these in v0:

```txt
pages/_error.tsx
pages/+error.tsx
pages/error.tsx
pages/not-found.tsx
pages/global-error.tsx
```

Those patterns come from other frameworks' nested error boundary systems and
would weaken Resumable's v0 mental model. Nitro's native `errorHandler` remains
available through top-level `nitro` config for advanced runtime/server error
handling.

### Route Scope For v0

Required in v0:

- Static routes.
- Nested routes.
- `index.tsx`.
- `index.mdx`.
- `.tsx` page routes.
- `.mdx` page routes.
- Single dynamic segments with `[param].tsx`.
- Single dynamic segments with `[param].mdx`.
- Final catch-all segments with `[...param].tsx`.
- Final catch-all segments with `[...param].mdx`.
- Root status pages with `404.tsx`, `404.mdx`, `500.tsx`, and `500.mdx`.
- Hard route conflict detection.

Deferred unless explicitly added:

- Nested status pages.
- Plain `.md` page routes.
- Route-level error boundaries.
- Optional segments.
- Route groups.
- Non-final catch-all segments.
- Multiple catch-all segments in one route.
- Per-route data loading.
- File-based layouts.
- Resumable-specific API route syntax beyond Nitro-native `api/`.

Nitro already supports catch-all routes, route groups, HTTP method suffixes, and
programmatic handlers for server routes. Resumable adopts Nitro-compatible
catch-all naming for UI pages, but should not copy the rest of Nitro's server
routing surface into the page convention until there is a clear product reason.

## API Routes

Resumable v0 supports top-level `api/` as Nitro-native API routes:

```txt
api/health.ts          -> /api/health
api/users/[id].get.ts  -> GET /api/users/:id
api/proxy/[...path].ts -> /api/proxy/**
```

API route files use Nitro's handler APIs directly:

```ts
import { defineHandler } from "nitro";

export default defineHandler(() => {
  return { ok: true };
});
```

Dynamic params use Nitro's event APIs:

```ts
import { defineHandler } from "nitro";

export default defineHandler((event) => {
  return {
    id: event.context.params!.id
  };
});
```

Core rule:

```txt
pages/ defines Qwik UI routes.
api/ defines Nitro API routes under /api.
middleware/ defines request pipeline behavior.
```

Do not put API routes inside `pages/`:

```txt
pages/api/health.ts
pages/about.tsx with defineHandler()
```

Those patterns make `pages/` ambiguous. In Resumable v0, every route module in
`pages/` must default export a Qwik component. Nitro handlers belong in `api/`,
middleware, or explicit Nitro config.

Top-level `routes/` is not part of the canonical Resumable app shape in v0. For
advanced non-`/api` server endpoints, use Nitro's native `handlers` config:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    handlers: [
      {
        route: "/webhook",
        handler: "./server/webhook.post.ts",
        method: "post"
      }
    ]
  }
});
```

Nitro's broader server routing surface remains available through Nitro config,
but Resumable documentation should keep the normal app structure focused on
`pages/`, `api/`, and `middleware/`.

## Layouts

Layouts are explicit components, not special route files.

Use:

```txt
components/
  layouts/
    MarketingLayout.tsx
```

Then in a page:

```tsx
import { component$ } from "@qwik.dev/core";
import { MarketingLayout } from "../components/layouts/MarketingLayout";

export default component$(() => {
  return (
    <MarketingLayout>
      <h1>About</h1>
    </MarketingLayout>
  );
});
```

Core rule:

```txt
The route is defined by the file path.
The UI tree is defined by the component tree.
```

Avoid these in v0:

```txt
pages/layout.tsx
pages/blog/layout.tsx
```

Implicit nested layout tracing can be added later as an advanced feature. It is
not part of the v0 mental model.

## Middleware

Middleware is top-level and adjacent to `pages/`.

```txt
middleware/
  00.logger.ts
  10.auth.ts
```

Core rule:

```txt
pages/ defines UI routes.
middleware/ defines request pipeline behavior.
```

Middleware should map as directly as possible to Nitro middleware. Resumable
should wire Nitro so that top-level `middleware/` is registered with Nitro's
request pipeline without requiring users to create a `server/` directory.

Middleware files should use Nitro's middleware or handler APIs:

```ts
import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
  event.context.requestId = crypto.randomUUID();
});
```

Execution order follows Nitro's filename sort order. Use numeric prefixes for
predictable ordering:

```txt
00.logger.ts
10.auth.ts
20.analytics.ts
```

Do not put middleware inside the page tree:

```txt
pages/blog/middleware.ts
pages/blog/_middleware.ts
```

For route-specific behavior, use Nitro-style checks or native Nitro config
rather than inventing a page-local middleware convention.

Examples:

```ts
import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
  if (!event.url.pathname.startsWith("/admin")) {
    return;
  }

  event.context.requiresAuth = true;
});
```

Or use native Nitro `handlers`:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    handlers: [
      {
        route: "/admin/**",
        handler: "./middleware/10.auth.ts",
        middleware: true
      }
    ]
  }
});
```

Returning a response from middleware short-circuits the request. That behavior
comes from Nitro and should not be wrapped in a Resumable-specific abstraction.

## Configuration

Resumable has no `resumable.config.ts`.

Resumable is installed through Vite:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],

  nitro: {
    preset: "node_server",
    routeRules: {
      "/blog/**": { swr: 600 }
    }
  }
});
```

The `nitro` key is native app-level Nitro config. Resumable should pass it
through and merge only the internal defaults required for Qwik rendering, page
routing, and top-level middleware.

Resumable should not forward, mirror, or rename Qwik Vite plugin options. If a
user needs Qwik plugin options, they pass them directly to `qwik()`.

Resumable should not expose normal Nitro config through a `nitro` option on
`resumable()`. If a future escape hatch is needed for rare Nitro Vite plugin
internals, it should be explicit and named after the plugin layer, not confused
with app-level Nitro config.

If a user needs Nitro features, they use Nitro config names directly:

- `preset`
- `routeRules`
- `runtimeConfig`
- `publicAssets`
- `serverAssets`
- `handlers`
- `plugins`
- `storage`
- `devStorage`
- `openAPI`
- `devProxy`
- `prerender`

Resumable documentation should link to Nitro docs instead of re-documenting the
entire Nitro surface area.

## Rendering Architecture

The fixture proves the viable shape:

- A server entry renders Qwik to HTML.
- Client and server assets are collected through Nitro/Vite asset queries.
- Nitro returns a standard `Response`.

Resumable v0 should hide this ceremony. A user writes page components; the
framework supplies the renderer.

Decision: Resumable v0 uses Nitro's renderer as the page rendering entrypoint.

Nitro's renderer is a lowest-priority catch-all handler for unmatched requests.
Nitro still owns middleware, public assets, route rules, API/server routes, and
deployment behavior. When no more specific Nitro route matches, Nitro calls the
Resumable renderer.

Inside that renderer, Resumable owns the page framework work:

- Load a generated or virtual route manifest from `pages/`.
- Compile `.mdx` page modules into Qwik-compatible page modules before Qwik's
  optimizer consumes them.
- Match the request path against the manifest.
- Prefer static routes over dynamic routes, and dynamic routes over catch-all
  routes.
- Extract route params into `PageProps`.
- Load the matched route module's default export.
- Load top-level `document.tsx` when present, or use the built-in default document shell.
- Render the matched page inside the document shell's `Html` document boundary.
- Translate `Html` props into Qwik SSR container attributes.
- Inject client and SSR assets.
- Return a standard `Response`.

If no page route matches, the renderer renders `pages/404.tsx` or
`pages/404.mdx` when present, or a built-in minimal 404 page when absent, with
HTTP status 404.

A user-defined catch-all route such as `pages/[...slug].tsx` is still a normal
page route. It matches before the framework 404 surface because the 404 surface
only applies after the route manifest has no match.

If page matching or Qwik page rendering throws an unhandled error, the renderer
renders `pages/500.tsx` or `pages/500.mdx` when present, or a built-in minimal
500 page when absent, with HTTP status 500. If the user-defined 500 page itself
fails, Nitro's native error response is used.

The document shell receives `PageProps` for normal pages, status pages, and built-in
fallback pages. This is the primary v0 mechanism for route-specific `<html>`
and `<body>` attributes through the `Html` component.

This means Resumable should not generate one Nitro handler per page route in v0.
There is one internal Nitro renderer/dispatcher backed by a generated or virtual
route manifest.

The public contract is that:

- Nitro middleware runs before page rendering.
- More specific Nitro API/server routes run before page rendering.
- Nitro route rules apply to page requests.
- Nitro public assets are served before page rendering.
- Route conflicts fail before production output is emitted.
- Unmatched page requests render the Resumable 404 surface after static,
  dynamic, and user-defined catch-all routes have failed to match.
- Unhandled page rendering errors render the Resumable 500 surface when
  possible.
- `document.tsx` wraps normal pages, status pages, and built-in fallback pages.
- `document.tsx` can set request-specific `<html>` attributes through `Html` props.
- `document.tsx` owns `<head>` and can customize it from `PageProps`.
- Users do not manage Resumable-generated server files.

## Public Assets

Use top-level `public/`.

```txt
public/
  favicon.ico
  robots.txt
  images/logo.png
```

Public assets should follow Nitro behavior:

```txt
public/favicon.ico      -> /favicon.ico
public/robots.txt       -> /robots.txt
public/images/logo.png  -> /images/logo.png
```

Resumable should not create a separate public asset convention.

## Nitro Relationship

Resumable is a thin Qwik-oriented meta-framework over Nitro. It should preserve
Nitro's native concepts instead of renaming them.

Use Resumable terms for:

- UI pages.
- Page route manifest.
- Qwik rendering.
- Layout guidance.

Use Nitro terms for:

- API routes.
- Middleware.
- Route rules.
- Runtime config.
- Storage.
- Caching.
- Deployment presets.
- Server assets.
- Public assets.
- Programmatic handlers.
- Plugins.

When in doubt, expose the Nitro behavior rather than creating a Resumable alias.

## Docs Site Direction

The docs site will live at `resumable.dev`.

Primary docs pages should start with the working mental model:

```txt
document.tsx customizes the document shell.
pages/ maps to routes.
api/ maps to Nitro API routes.
layouts are components.
middleware is Nitro-native.
config lives in vite.config.ts.
```

Suggested initial docs:

- Getting Started
- Project Structure
- Document Shell
- Pages and Routing
- Composed MDX
- Navigation and Typed Routing
- API Routes
- Layouts
- Middleware
- Vite and Nitro Config
- Deploying
- Examples

AI examples can be included under examples or demos, not as the category or
headline positioning.

## v0 Acceptance Criteria

A minimal app should work with this structure:

```txt
  my-app/
  document.tsx
  pages/
    index.tsx
  vite.config.ts
  package.json
```

And this config:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
```

Build-time checks:

- Missing `pages/` should produce a direct error or a direct empty-app message.
- Page files without a default export should produce a direct error.
- `.mdx` page modules should compile to default-exported Qwik components.
- Composed MDX files should split on `--- content`, replace exactly one
  `<Content />` with the content body, and compile to default-exported Qwik
  components.
- Composed MDX files with multiple `--- content` delimiters should produce a
  direct error.
- Composed MDX files with zero or multiple `<Content />` slots should produce a
  direct error.
- Composed MDX files that import or define a binding named `Content` should
  produce a direct error.
- ESM imports or exports below `--- content` should produce a direct error.
- Frontmatter `layout` in an MDX route should produce a direct unsupported
  feature error.
- Conflicting routes should produce a direct error.
- `.tsx` and `.mdx` files that map to the same URL should conflict.
- Unsupported route patterns should produce a direct error.
- Catch-all routes that are not the final route segment should produce a direct
  error.
- Nested status pages such as `pages/blog/404.tsx` or `pages/blog/404.mdx`
  should produce a direct unsupported feature error.
- API routes inside `pages/api/` should produce a direct unsupported feature
  error.
- Page files that default export a Nitro handler instead of a Qwik component
  should produce a direct error.
- `document.tsx`, when present, must default export a Qwik component.
- `document.tsx`, when present, should render `Html` from `@resumable.dev/core` as
  the document boundary.
- Framework-owned page metadata APIs such as `<Head />`, `head`, and `metadata`
  should produce a direct unsupported feature error.
- Generated typed-routing declarations should update from `pages/`.
- Route-pattern anchors and `Link` usages with missing or invalid params should
  produce direct type or build errors.
- Unsupported document shell aliases such as legacy app-named document files,
  `root.tsx`, `shell.tsx`, `pages/document.tsx`, and `pages/_document.tsx`
  should produce a direct unsupported feature error.

Runtime checks:

- `document.tsx` wraps rendered pages when present.
- `document.tsx` receives `PageProps` with `status`, `params`, and `url`.
- `document.tsx` can set route-specific `<html>` attributes through `Html` props.
- `document.tsx` can set route-specific `<body>` attributes from `PageProps`.
- `document.tsx` can set route-specific `<head>` content from `PageProps`.
- Native `<a>` uses typed platform navigation.
- `Link` uses the same route typing and opts into SPA navigation.
- `GET /` renders `pages/index.tsx`.
- `GET /docs` renders `pages/docs.mdx` when present.
- A Composed MDX page renders its content body at the visible `<Content />`
  position in the component tree.
- `GET /about` renders `pages/about.tsx`.
- `GET /blog` renders `pages/blog/index.tsx`.
- `GET /blog/test` renders `pages/blog/test.tsx`.
- `GET /blog/hello` renders `pages/blog/[slug].tsx` with
  `props.params.slug === "hello"`.
- `GET /docs/guides/getting-started` renders `pages/docs/[...slug].tsx` with
  `props.params.slug === "guides/getting-started"`.
- `GET /docs/guides/getting-started` can render
  `pages/docs/[...slug].mdx` with
  `props.params.slug === "guides/getting-started"`.
- Static routes win over dynamic routes, and dynamic routes win over catch-all
  routes.
- Unmatched page requests render `pages/404.tsx` or `pages/404.mdx` with status
  404 when present.
- Unhandled page rendering errors render `pages/500.tsx` or `pages/500.mdx`
  with status 500 when present.
- If the user-defined 500 page fails, Nitro's native error response is used.
- `GET /api/health` renders `api/health.ts` through Nitro.
- Top-level middleware runs before page rendering.
- Top-level middleware runs before API routes.
- `public/` assets are served directly.
- Native Nitro `routeRules` still apply.

## Open Questions

These should remain unresolved until implementation pressure makes them
necessary:

- Should `src/` be allowed as an optional source root for advanced users while
  keeping top-level `pages/` canonical?

## References

- Nitro v3 introduction and Vite integration: https://nitro.build/docs
- Nitro v3 configuration through `nitro.config.ts` or top-level Vite `nitro`:
  https://nitro.build/docs/configuration
- Nitro v3 config reference: https://nitro.build/config
- Nitro v3 routing, programmatic handlers, middleware, and route rules:
  https://nitro.build/docs/routing
- Nitro v3 renderer: https://nitro.build/docs/renderer
- Nitro v3 server entry: https://nitro.build/docs/server-entry
- Nitro v3 public assets: https://nitro.build/docs/assets
- Nitro Vite plugin example: https://nitro.build/examples/vite-nitro-plugin
- Nitro Vite SSR example: https://nitro.build/examples/vite-ssr-html
- Nitro middleware example: https://nitro.build/examples/middleware
- Nitro Solid SSR example showing `?assets=client` and `?assets=ssr`:
  https://nitro.build/examples/vite-ssr-solid
- Satteri Markdown and MDX compiler:
  https://github.com/bruits/satteri
- Satteri package README:
  https://raw.githubusercontent.com/bruits/satteri/main/packages/satteri/README.md
- MDX syntax:
  https://mdxjs.com/docs/what-is-mdx/
- CommonMark thematic breaks:
  https://spec.commonmark.org/
- Grep MCP sample, TanStack Nitro Vite config:
  https://github.com/TanStack/router/blob/main/examples/solid/start-basic-nitro/vite.config.ts
- Grep MCP sample, SST TanStack Start Nitro config:
  https://github.com/anomalyco/sst/blob/dev/examples/aws-tanstack-start/vite.config.ts
