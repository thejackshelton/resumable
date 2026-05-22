# Resumable v0 Specification

Status: Draft

## Positioning

Name: Resumable

Descriptor: A minimal Qwik meta-framework powered by Nitro.

Domain: `resumable.dev`

Core package: `@resumable.dev/core`

Primary category: Qwik meta-framework.

Resumable should not be described as an AI framework or AI meta-framework in
primary positioning. AI examples can exist as demos or proof-of-concept apps,
but AI is not the category.

Short description:

> Resumable is a minimal Qwik + Nitro framework where `pages/` maps to routes,
> layouts are normal components, middleware is Nitro-native, and configuration
> lives in `vite.config.ts`.

Even shorter mental model:

- Top-level pages.
- Astro-style TSX routing.
- Explicit Qwik layout components.
- Top-level Nitro middleware.
- Configured through Vite.

## Research Baseline

The existing `fixtures/nitro-app` proves that Qwik and Nitro v3 can work
together through Vite. The fixture combines:

- Nitro's Vite plugin from `nitro/vite`.
- The Qwik Vite plugin.
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

Grep MCP sampling of public repositories also shows active Vite-based
frameworks and examples using `nitro()` alongside framework Vite plugins, and
using top-level `nitro: {}` in `vite.config.ts` for native Nitro config.

## Goals

Resumable v0 should provide the smallest useful Qwik + Nitro app model:

- One core Vite plugin: `resumable()`.
- A top-level `pages/` directory for UI routes.
- Qwik components as page modules.
- Explicit layout components imported by pages.
- Top-level `middleware/` that maps to Nitro middleware semantics.
- Native Nitro configuration under the top-level Vite `nitro` key.
- Hard build errors for ambiguous routing.
- No framework config file.

The v0 experience should be obvious to junior developers and reliable for AI
agents editing a codebase. The URL should be readable from the file path.

## Non-Goals

Resumable v0 should not include:

- `src/pages/` as a required or canonical route directory.
- `resumable.config.ts`.
- `nitro.config.ts` as the documented app config path.
- Special layout files such as `pages/layout.tsx`.
- Page-local middleware files such as `pages/blog/middleware.ts`.
- A new server runtime abstraction over Nitro.
- AI-specific framework primitives.
- A data-loading API unless it is added intentionally after the route contract
  is stable.

## Canonical App Shape

```txt
my-app/
  pages/
    index.tsx
    about.tsx
    blog/
      index.tsx
      test.tsx
      [slug].tsx

  middleware/
    00.logger.ts
    10.auth.ts

  components/
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
src/pages/
resumable.config.ts
nitro.config.ts
```

## Package API

The public Vite entrypoint is:

```ts
import { resumable } from "@resumable.dev/core/vite";
```

The canonical Vite config is:

```ts
import { defineConfig } from "vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [resumable()],

  nitro: {
    // Native Nitro v3 config.
  }
});
```

API boundary:

```txt
resumable()  -> Resumable framework and plugin wiring
nitro: {}    -> native Nitro config
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
  plugins: [resumable()],
  nitro: {}
});
```

`resumable()` is responsible for framework wiring. A user should not need to add
Nitro's Vite plugin or Qwik's Vite plugin separately in a standard Resumable
app.

## Routing

Resumable uses a top-level `pages/` directory.

Route files are `.tsx` files. Every route file in `pages/` maps mechanically to
a URL. `index.tsx` maps to the current folder root.

Required v0 mappings:

```txt
pages/index.tsx          -> /
pages/about.tsx          -> /about
pages/blog/index.tsx     -> /blog
pages/blog/test.tsx      -> /blog/test
pages/blog/[slug].tsx    -> /blog/:slug
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

### Route Modules

A page module must default export a Qwik component.

```tsx
import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return <h1>Home</h1>;
});
```

Named exports are reserved for future features. v0 should not require page
metadata, route loaders, actions, or static params.

### Route Normalization

Route conflict detection should normalize routes before comparison:

- Remove the `pages/` prefix.
- Remove the `.tsx` extension.
- Convert trailing `/index` to the current folder root.
- Convert `[param]` segments to dynamic URL segments.
- Ignore the dynamic parameter name for conflict identity.
- Normalize trailing slashes away except for `/`.

Examples:

```txt
pages/blog.tsx        -> /blog
pages/blog/index.tsx  -> /blog
pages/blog/[id].tsx   -> /blog/:param
pages/blog/[slug].tsx -> /blog/:param
```

`pages/blog/[id].tsx` and `pages/blog/[slug].tsx` conflict because both match
the same URL shape.

Static and dynamic siblings are allowed when their normalized route shapes are
different:

```txt
pages/blog/test.tsx   -> /blog/test
pages/blog/[slug].tsx -> /blog/:param
```

The runtime matcher must prefer static routes over dynamic routes.

### Route Conflicts

Conflicts are hard build errors.

Example conflict:

```txt
pages/blog.tsx
pages/blog/index.tsx
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

Choose one.
```

The error must name the URL and the exact files. It should not be a generic Vite
or Nitro error.

### Route Scope For v0

Required in v0:

- Static routes.
- Nested routes.
- `index.tsx`.
- Single dynamic segments with `[param].tsx`.
- Hard route conflict detection.

Deferred unless explicitly added:

- Catch-all segments.
- Optional segments.
- Route groups.
- Per-route data loading.
- File-based layouts.
- API route files owned by Resumable.

Nitro already supports catch-all routes, route groups, HTTP method suffixes, and
programmatic handlers for server routes. Resumable should not copy those
features into the UI page convention until there is a clear product reason.

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
export default defineConfig({
  plugins: [resumable()],
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
import { defineConfig } from "vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [resumable()],

  nitro: {
    preset: "node_server",
    routeRules: {
      "/blog/**": { swr: 600 }
    }
  }
});
```

The `nitro` key is native Nitro config. Resumable should pass it through and
merge only the internal defaults required for Qwik rendering, page routing, and
top-level middleware.

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

Implementation should generate or virtualize:

- A route manifest from `pages/`.
- A Qwik SSR entry that selects the matched page component.
- Client and SSR asset injection.
- Nitro route or renderer wiring.

The exact internal mechanism can be virtual modules, generated files under a
build directory, Nitro `routes`, Nitro `handlers`, or a Nitro renderer. The
public contract is that:

- Nitro middleware runs before page rendering.
- Nitro route rules apply to page requests.
- Nitro public assets are served before page rendering.
- Route conflicts fail before production output is emitted.
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
pages/ maps to routes.
layouts are components.
middleware is Nitro-native.
config lives in vite.config.ts.
```

Suggested initial docs:

- Getting Started
- Project Structure
- Pages and Routing
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
  pages/
    index.tsx
  vite.config.ts
  package.json
```

And this config:

```ts
import { defineConfig } from "vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [resumable()]
});
```

Build-time checks:

- Missing `pages/` should produce a direct error or a direct empty-app message.
- Page files without a default export should produce a direct error.
- Conflicting routes should produce a direct error.
- Unsupported route patterns should produce a direct error.

Runtime checks:

- `GET /` renders `pages/index.tsx`.
- `GET /about` renders `pages/about.tsx`.
- `GET /blog` renders `pages/blog/index.tsx`.
- `GET /blog/test` renders `pages/blog/test.tsx`.
- `GET /blog/hello` renders `pages/blog/[slug].tsx`.
- Static routes win over dynamic routes.
- Top-level middleware runs before page rendering.
- `public/` assets are served directly.
- Native Nitro `routeRules` still apply.

## Open Questions

These should remain unresolved until implementation pressure makes them
necessary:

- Should v0 support catch-all page routes with `[...slug].tsx`, or defer them?
- Should route params be passed to pages through props, context, or a Qwik hook?
- Should Resumable generate one Nitro handler per page route or use one renderer
  dispatcher?
- Should API routes be part of Resumable's public app shape, or should v0 direct
  users to Nitro-native `routes/` and `api/` conventions only?
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
- Grep MCP sample, TanStack Nitro Vite config:
  https://github.com/TanStack/router/blob/main/examples/solid/start-basic-nitro/vite.config.ts
- Grep MCP sample, SST TanStack Start Nitro config:
  https://github.com/anomalyco/sst/blob/dev/examples/aws-tanstack-start/vite.config.ts
