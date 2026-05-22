# Resumable Implementation Plan

Status: Draft

Read first: [`state.md`](./state.md)

Parent specs:

- [`SPEC.md`](./SPEC.md)
- [`CLI_SPEC.md`](./CLI_SPEC.md)
- [`TYPED_ROUTING.md`](./TYPED_ROUTING.md)
- [`DATA_FETCHING.md`](./DATA_FETCHING.md)

## Purpose

This document is the implementation guide for Codex/GPT agents. It indexes the
specs, freezes the current build order, and separates v0 implementation work
from design that is intentionally deferred.

This is not a replacement for the product specs. If a product/API question is
not answered here, read the relevant spec instead of inventing a new convention.

## Research Requirements

Implementation work must be evidence-driven.

Before implementing Qwik-facing behavior, inspect the local Qwik repository:

```txt
/Users/jacksm5pro/dev/open-source/qwik
```

Expected branch:

```txt
build/v2
```

Use that local repository to confirm what is actually available in Qwik v2 core,
including:

- public imports from `@qwik.dev/core`
- server rendering APIs such as `renderToStream()` and `renderToString()`
- JSX intrinsic types and `PropsOf`
- Qwik optimizer and `$` API behavior
- Qwik Vite plugin behavior
- Qwik SSR container attributes and manifest expectations

Implementation agents should use grep MCP as a normal part of implementation
research. Use it before making non-trivial choices about CLI structure, routing,
typed routing, server function transport, Nitro integration, SSR, MDX, and data
fetching. Prefer real framework/source examples over recalled patterns.

Nitro v3 docs are the primary server/runtime reference:

```txt
https://nitro.build/docs
```

When Nitro behavior is unclear, consult the Nitro docs instead of creating a
Resumable-specific abstraction or alias.

## Final Direction

```txt
Pages are Resumable.
Components are Qwik.
Server behavior is Nitro.
Configuration is Vite.
Tooling is Vite+.
```

Framework boundary:

- User config imports `qwik()` explicitly.
- User config imports `resumable()` from `@resumable.dev/core/vite`.
- Generated apps import `defineConfig` from `vite-plus`.
- `resumable()` wires Nitro internally.
- Users do not add `nitro()` in standard Resumable apps.
- Users configure Nitro with top-level `nitro: {}` in `vite.config.ts`.
- `api/`, `middleware/`, and `public/` use Nitro-native behavior.
- `pages/` uses Resumable UI routing.

## Initial Implementation Scope

Build in the first core implementation pass:

- Workspace/package alignment for `@resumable.dev/core` and
  `@resumable.dev/cli`.
- `create-resumable` create flow.
- `Minimal`, `App`, and `Full-stack` starters.
- Vite+ generated app scripts.
- `resumable()` Vite plugin.
- Top-level `pages/` route scanning.
- `.tsx` page modules.
- Dynamic `[param]` and catch-all `[...slug]` routes.
- Route conflict detection with direct errors.
- One internal Nitro page renderer/dispatcher.
- Virtual or generated route manifest.
- Qwik SSR for matched pages.
- Optional top-level `app.tsx` with `Html` and `Head`.
- Root `404.tsx` and `500.tsx` status pages.
- Nitro-native `api/`, `middleware/`, and `public/` passthrough.
- Typed route generation.
- Native anchor JSX type augmentation.
- `Link` component for SPA navigation.

Do not build in the first core implementation pass:

- Public `query$`, `action$`, or `schema` runtime.
- Public data cache implementation.
- Native form action lowering.
- MDX page support.
- Docs starter.
- Deno project format.
- User/tenant durable cache partitioning.
- Enhanced form state helpers.

These delayed items can be implemented after their fixtures prove the path. MDX
is still part of the main framework spec; it should come after the `.tsx`
route/SSR path is stable, not before.

## Build Order

### 0. Spec And Package Hygiene

Goal: make the repository implementation-ready.

Tasks:

- Keep all specs in `specs/`.
- Keep `state.md` current as work progresses.
- Rename or align `libs/cli` package direction toward `@resumable.dev/cli`
  with `create-resumable` and `resumable` bins.
- Keep `libs/core` as `@resumable.dev/core`.
- Keep root package scripts using Vite+.

Exit criteria:

- `pnpm check.format` passes.
- No root-level spec files remain.
- Future agents can start from `specs/README.md`.

### 1. CLI Create Flow

Goal: create a working generated app with the agreed DX.

Build:

- `CreateProgram` with lifecycle:

```txt
configure -> validate -> interact -> execute
```

- Package-manager inference from invoking command.
- Project name prompt only when no positional target is passed.
- Project format prompt:

```txt
Node        package.json
Bun         package.json
Deno        deno.json
```

- Starter prompt:

```txt
Minimal     one page
App         layouts, status pages
Docs        MDX docs routes
Full-stack  app plus Nitro api/ and middleware/
```

Initial visible starters should be `Minimal`, `App`, and `Full-stack`. Show
`Docs` only after the MDX fixture passes.

Generated scripts should use local `vp`:

```json
{
  "scripts": {
    "dev": "vp dev",
    "build": "vp build",
    "preview": "vp preview",
    "check": "vp check",
    "format": "vp fmt",
    "test": "vp test"
  }
}
```

Exit criteria:

- `pnpm create resumable my-app --yes` creates the Minimal starter.
- Generated `vite.config.ts` uses `vite-plus`, `qwik()`, and `resumable()`.
- Generated config does not call `nitro()`.
- Generated app has no `resumable.config.ts`, `nitro.config.ts`, `src/pages/`,
  or `pages/api/`.

### 2. Core Vite Plugin Skeleton

Goal: `resumable()` exists and installs the framework wiring points.

Research before coding:

- Inspect local Qwik `build/v2` Vite plugin and optimizer behavior.
- Check Nitro v3 Vite integration docs: https://nitro.build/docs
- Use grep MCP for current examples of frameworks using Nitro with Vite.

Build:

- Public export `@resumable.dev/core/vite`.
- Vite plugin skeleton.
- Nitro plugin wiring inside `resumable()`.
- Internal defaults for top-level `api/`, `middleware/`, and `public/`.
- Direct error if user duplicates Nitro plugin wiring in a standard app.
- No wrapper over Qwik plugin options.

Exit criteria:

- A fixture can use `plugins: [qwik(), resumable()]`.
- Top-level `nitro: {}` config still reaches Nitro.
- User-authored `api/`, `middleware/`, and `public/` use Nitro behavior.

### 3. Route Manifest

Goal: turn `pages/` into a deterministic UI route manifest.

Build:

- Scan top-level `pages/`.
- Support `.tsx`.
- Normalize routes.
- Support `index.tsx`.
- Support `[param].tsx`.
- Support `[...slug].tsx`.
- Reserve `404.tsx` and `500.tsx` as root status pages.
- Fail on conflicts with exact files.
- Fail on unsupported patterns with direct messages.

Exit criteria:

- `pages/index.tsx -> /`.
- `pages/blog/index.tsx -> /blog`.
- `pages/blog/[slug].tsx -> /blog/:slug`.
- `pages/docs/[...slug].tsx -> /docs/**`.
- `pages/blog.tsx` and `pages/blog/index.tsx` conflict.
- `pages/blog/[id].tsx` and `pages/blog/[slug].tsx` conflict.

### 4. Qwik SSR Renderer

Goal: matched page routes render through one internal Nitro dispatcher.

Research before coding:

- Inspect local Qwik `build/v2` server rendering implementation and types.
- Confirm whether `renderToStream()` or `renderToString()` is the right first
  implementation target.
- Use grep MCP for current Qwik SSR entry examples and Nitro renderer examples.

Build:

- One internal Nitro page renderer/dispatcher.
- Virtual or generated route manifest import.
- Qwik server entry.
- Client entry.
- Asset injection using the proven fixture pattern.
- Page default export validation.
- `PageProps` passed only to the default page component.
- Static route priority over dynamic routes.
- Catch-all fallback behavior.

Exit criteria:

- `GET /` renders `pages/index.tsx`.
- `GET /about` renders `pages/about.tsx`.
- `GET /blog/test` chooses static route over `[slug]`.
- `GET /blog/hello` renders `[slug]`.
- Rendered HTML contains Qwik resume/runtime assets.

### 5. App Shell And Head

Goal: support document customization without file-based layouts.

Build:

- Optional top-level `app.tsx`.
- `Html` component.
- `Head` component.
- Default internal document when no `app.tsx` exists.
- Page/layout-level visible `Head` support.
- Direct error for unsupported shell filenames.

Exit criteria:

- Minimal starter works without `app.tsx`.
- App starter can customize `<html>`, `<head>`, and `<body>`.
- Page content can contribute head tags.
- No `pages/layout.tsx` or `pages/_app.tsx` behavior exists.

### 6. Status Pages

Goal: root 404 and 500 pages behave predictably.

Build:

- `pages/404.tsx`.
- `pages/500.tsx`.
- 404 status for unmatched page requests.
- 500 status for page rendering failures.
- Nitro API route errors keep Nitro semantics.

Exit criteria:

- Missing page renders 404 UI with status 404.
- Page render failure renders 500 UI with status 500.
- Missing API route does not accidentally render page 404 if Nitro owns the
  request.

### 7. Typed Routing

Goal: generated route types match the manifest.

Research before coding:

- Inspect local Qwik `build/v2` JSX type augmentation and intrinsic attribute
  typing.
- Use grep MCP for current typed-route generation patterns in public
  frameworks.

Build:

- Generated declaration file.
- Route union.
- Param map.
- Native anchor JSX augmentation.
- `Link` component.
- Static route href typing.
- Dynamic route params typing.
- Catch-all params typing.
- Dev/build regeneration.

Exit criteria:

- `<a href="/about">` type-checks.
- `<a href="/blog/[slug]" params={{ slug: "hello" }}>` type-checks.
- Missing dynamic params fail type-checking.
- Unknown routes fail type-checking.
- `Link` gets the same route types as native anchors.

### 8. SPA Navigation

Goal: `Link` can enhance navigation without changing platform semantics.

Build:

- `Link` renders an anchor.
- External links are not intercepted.
- Download/reload behavior is preserved.
- Internal page payload endpoint or renderer mode.
- Route module transition.
- Status page behavior during SPA navigation.

Exit criteria:

- App works as normal navigation without JavaScript.
- `Link` enhances internal page navigation when JavaScript is available.
- Static route priority and dynamic params match SSR behavior.

### 9. MDX Fixture And Docs Starter

Goal: prove first-class MDX before showing the Docs starter.

Build only after previous route/SSR path is stable:

- Satteri POC.
- `.mdx` page module compilation.
- Qwik v2-compatible output.
- Qwik optimizer compatibility.
- MDX source map/error quality.
- Docs starter.

Exit criteria:

- `pages/index.mdx` renders.
- `pages/docs/[...slug].mdx` renders.
- Qwik components can be imported inside MDX.
- `.tsx` and `.mdx` route conflicts are detected.

### 10. Data Fetching Prototype

Goal: prove the data direction before public release.

Research before coding:

- Inspect local Qwik `build/v2` async primitives, serialization support, and
  optimizer `$` extraction behavior.
- Use grep MCP for current query/action/server-function implementations before
  choosing transport, refresh, validation, or cache behavior.
- Check Nitro v3 docs before using Nitro cache/storage primitives.

Prototype after SSR and SPA payloads exist:

- `schema`.
- `query$`.
- `action$`.
- request dedupe.
- query records.
- SSR serialization.
- SPA query deltas.
- `ctx.refresh(...)`.
- native form action lowering.

Exit criteria:

- Do not ship public data APIs until the confidence gates in
  [`DATA_FETCHING.md`](./DATA_FETCHING.md) pass.

## Parallel Work

Can happen in parallel:

- CLI create flow and core route manifest, once package names are agreed.
- Starter file content and route manifest tests.
- CLI dependency/package refactor and core Vite plugin skeleton.
- Typed routing generator and route conflict tests, after manifest shape is
  stable.
- Nitro-native API/middleware/public fixtures and page renderer work.

Should wait:

- `Link` SPA navigation waits for SSR route matching and manifest shape.
- MDX waits for route manifest and Qwik SSR skeleton.
- Docs starter waits for MDX fixture.
- Data fetching waits for SSR render context and SPA payload protocol.
- Deno waits for a complete dev/build/runtime fixture.

## Fixture Matrix

Required fixtures:

```txt
fixtures/minimal
fixtures/app
fixtures/full-stack
fixtures/route-conflicts
fixtures/typed-routing
```

Later fixtures:

```txt
fixtures/mdx
fixtures/data-fetching
fixtures/deno
fixtures/bun
```

Existing fixture:

```txt
fixtures/nitro-app
```

Use `fixtures/nitro-app` as proof that Qwik and Nitro can work together, but do
not let its hand-written ceremony leak into user templates.

## Implementation Guardrails

- Prefer generated or virtual modules over user-visible generated server files.
- Do not create `resumable.config.ts`.
- Do not require `nitro.config.ts`.
- Do not wrap Qwik plugin options.
- Do not rename Nitro concepts.
- Do not implement page-local middleware.
- Do not implement file-based layouts in v0.
- Do not implement data fetching before route/SSR/SPAs are proven.
- Do not expose prototype/unstable labels in user prompts.
- Keep errors direct and file-specific.
- Check local Qwik `build/v2`, grep MCP examples, and Nitro v3 docs before
  making Qwik/Nitro-facing implementation decisions.

## Completion Gates

Before claiming v0 core complete:

- `pnpm check.format` passes.
- Package build passes.
- Minimal generated app builds.
- App generated app builds.
- Full-stack generated app builds.
- Route conflict fixture fails with the expected direct error.
- Nitro `api/`, `middleware/`, `public/`, and top-level `nitro: {}` behavior is
  verified.
- Qwik SSR output contains expected page HTML.
- Typed routing fixture catches expected valid and invalid cases.
- `specs/state.md` is updated with completed milestones and remaining deferred
  work.
