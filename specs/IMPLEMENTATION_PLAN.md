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
typed routing, Nitro integration, SSR, MDX, and Nitro-owned data fetching.
Prefer real framework/source examples over recalled patterns.

Before changing bundler integration code such as `libs/core/src/vite/vite.ts`,
Vite plugins, Nitro/Vite wiring, virtual modules, environment entries, or build
inputs, use grep MCP to research current Vite environment API patterns for the
specific task. Prefer `configEnvironment()`, `applyToEnvironment()`,
`environment.config.consumer`, and `build.rolldownOptions` patterns that match
current Vite/Nitro usage over name-specific environment checks or deprecated
`rollupOptions` wiring. Record the relevant red/green evidence in
`specs/state.md`.

Nitro v3 docs are the primary server/runtime reference:

```txt
https://nitro.build/docs
```

When Nitro behavior is unclear, consult the Nitro docs instead of creating a
Resumable-specific abstraction or alias.

## Shared Path And URL Helpers

Resumable should not hand-roll path or URL normalization when a small shared
helper already exists. Use these packages as the default implementation
building blocks:

- `pathe` for filesystem-like paths and Vite file IDs: `normalize`, `join`,
  `relative`, `dirname`, `basename`, `extname`, and `resolve`.
- `ufo` for URL/pathname behavior: leading/trailing slash handling, URL
  parsing, URL path joining, query parsing/stringifying, and route pathname
  normalization.

Do not use Node `path` or `url` helpers for framework path/URL normalization in
`libs/core` or the CLI create flow. The CLI may still use Node APIs for actual
Node-only responsibilities such as filesystem writes, temp directories,
process spawning, and standard streams.

Do not add local slash-normalization regexes such as replacing backslashes with
slashes, stripping leading slashes, trimming trailing slashes, or joining URL
segments unless `pathe`/`ufo` cannot represent the behavior. If an exception is
needed, keep it local, explain why the helper package does not cover it, and
add focused evidence.

Before changing routing, CLI path handling, generated file paths, request URL
matching, typed-route generation, SPA navigation, or data endpoint URLs, audit
the touched files for:

```txt
node:path
node:url
pathToFileURL
replace(/\\/g, "/")
replace(/^\/+/, "")
manual URL query/string parsing
manual route pathname joining
```

If one of those patterns is present in production code, either replace it with
`pathe`/`ufo` or record why it is intentionally kept.

## TDD And Surgical Change Requirements

Implementation must be test-driven and surgical. Do not add framework code,
CLI behavior, package changes, dependencies, fixtures, or generated output until
there is concrete evidence for the exact behavior being implemented.

Required loop for every implementation slice:

1. Pick one acceptance criterion or one directly related cluster of criteria.
2. Add or identify the smallest test, fixture, type-check, smoke command, or
   source inspection that proves the current behavior is missing.
3. Run that evidence and record the failing output or observed gap.
4. Make the smallest code change that can satisfy only that evidence.
5. Re-run the narrow evidence first.
6. Run the relevant package/workspace checks for the touched surface.
7. Update `specs/state.md` with the evidence before marking milestone progress.

Production code changes without prior failing or missing-behavior evidence are
not allowed. If a behavior is already covered by an existing failing test,
state that and use it. If a behavior is not practical to prove with a test yet,
create the smallest fixture or smoke verifier first, then add code.

Surgical change rules:

- Keep each patch scoped to the acceptance criterion under test.
- Prefer one failing test or fixture per behavioral change.
- Before editing, list the behavior that is in scope and the nearby behaviors
  that are intentionally out of scope. Thinking longer is preferred to shipping
  a broad patch that happens to pass tests.
- If a change starts pulling in extra virtual modules, public exports,
  generated files, aliases, fixture variants, or compatibility behavior, stop
  and split the work into a later TDD slice unless the current red evidence
  directly requires it.
- Do not perform opportunistic refactors, formatting churn, file moves, package
  renames, or dependency changes while implementing unrelated behavior.
- Do not add placeholders, broad skeletons, future APIs, or compatibility
  layers unless the current failing evidence requires them.
- Do not widen milestone scope to make a test easier to pass.
- Use existing local patterns and helpers before adding abstractions.
- Prefer `pathe` and `ufo` over local path/URL helper functions or Node
  `path`/`url` imports for normalization behavior.
- When changing generated output, assert both required files and forbidden
  files so the generator cannot drift.
- CLI generated-output evidence must run on disk under `/tmp`, invoke the real
  create flow or built CLI against a destination path, and assert generated
  directories/files plus forbidden paths from the filesystem. This follows the
  QwikDev Astro create-package pattern in
  `QwikDev/astro` `build/v2`, `libs/create-qwikdev-astro/tests/cli.spec.ts`.
- When changing Vite/Nitro/Qwik wiring, prove plugin order, duplicate-plugin
  behavior, top-level config passthrough, and generated-user-config shape with
  focused tests or fixtures before broad smoke testing.
- Keep Vite plugin source organized as `src/vite/vite.ts` plus focused
  `src/vite/entries/*` virtual entry source files and
  `src/vite/runtime/*` reusable helpers when virtual entry code grows beyond
  trivial glue. The entry source files are real TypeScript files, are
  typechecked, and must keep app-root-sensitive `import.meta.glob("/...")`
  calls and Qwik runtime imports in the user's Vite graph. `src/vite/vite.ts`
  should resolve Resumable virtual IDs to those entry files and let Vite own
  loading, transformation, dependency analysis, and source maps. Avoid
  embedding multi-line entry modules as strings. Do not add plugin-local file
  reads, Node path/URL helpers, or custom transforms unless focused failing
  evidence proves Vite cannot handle the source file directly. Runtime helper
  modules hold typechecked pure logic that can be emitted and imported as
  package subpaths.
- Treat a green broad command as supporting evidence only after the narrow
  acceptance evidence has passed.

## Fixture QA Responsibility

Fixtures are executable QA evidence, not examples to keep green by assumption.
When implementing behavior that depends on a generated app, framework runtime,
Vite/Nitro integration, routing, SSR, or browser-visible output, the agent owns
proving that behavior through fixture tests before and after the code change.

For each fixture-backed implementation slice:

- Add or update the fixture test first so it fails for the missing behavior.
- Run the fixture like a user app where practical, using the real Vite, Nitro,
  Qwik, and Resumable integration path.
- Assert both positive behavior and forbidden behavior.
- Inspect actual generated, served, or rendered output, not only object shapes.
- Keep the fixture minimal, but make the QA deep enough to catch a broken app.
- Do not mark a slice complete because unit tests pass if the fixture path for
  that behavior has not been exercised.
- Record red and green fixture evidence in `specs/state.md`.

## Naming For Framework Glue

Use names that junior developers and AI agents can understand from the call
site without unpacking framework history. Prefer direct intent and ownership
over ceremonial names.

Good examples:

```ts
createNitroConfig(userConfig.nitro);
throwIfUserAddedNitro(config.plugins, nitroPluginsFromResumable);
routesPlugin();
configPlugin(nitroPlugins);
```

Avoid names that sound abstract, pattern-driven, or overly framework-branded
when the code does a simple thing:

```ts
withResumableNitroDefaults(...)
assertNoUserNitroPlugin(...)
routeManifestPlugin(...)
```

Naming rules for future implementation:

- Name functions after the action they perform or the object they return.
- Include ownership only when it resolves ambiguity, such as
  `nitroPluginsFromResumable`.
- Avoid `with*`, `handle*`, `process*`, `manager`, `orchestrator`, and similar
  vague glue names unless the surrounding code already uses that convention and
  the name is genuinely clearer.
- Prefer domain nouns users see in specs: `routes`, `pages`, `nitro`,
  `config`, `manifest`, `renderer`, `app`, and `status`.
- If a helper exists only to satisfy a framework hook, make the hook role clear:
  `routesPlugin`, `configPlugin`, `createNitroConfig`.
- Keep names short, but not cryptic. A reader should not need to inspect the
  function body to know why it exists.

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
- Optional top-level `document.tsx` with `Html`.
- Root `pages/404.tsx` and `pages/500.tsx` status pages.
- Nitro-native `api/`, `middleware/`, and `public/` passthrough.
- Typed route generation.
- Native anchor JSX type augmentation.
- `Link` component for SPA navigation.

Do not build in the first core implementation pass:

- A Resumable-owned data layer or server-function transport.
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

TDD sequence:

- First add focused tests or fixtures proving CLI package name/bins, argument
  validation, package-manager inference, prompt visibility, `--yes` defaults,
  generated Minimal files, generated Vite+ scripts, and forbidden file absence.
- Prove CLI path handling uses `pathe`/`ufo` rather than Node `path`/`url` or
  local slash-normalization helpers.
- Generated-app assertions must be disk-backed integration tests under `/tmp`,
  not only in-memory/unit assertions. Use a cleaned temporary root, run the
  create flow into `/tmp/.../my-app`, then assert the generated directory/file
  tree and key file contents from disk.
- Run those tests before implementation and preserve the failing evidence.
- Implement only the smallest CLI/package/template change needed for the next
  failing assertion.
- Re-run the focused create-flow tests before running workspace checks.

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

TDD sequence:

- First add focused tests or a minimal fixture proving
  `plugins: [qwik(), resumable()]`, absence of an added/wrapped Qwik plugin,
  internal Nitro wiring, duplicate user `nitro()` guardrails, and top-level
  `nitro: {}` passthrough.
- Run those tests before implementation and preserve the failing evidence.
- Implement only the smallest plugin change needed for the next failing
  assertion.
- Re-run the focused plugin tests before running workspace checks.

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
- Keep discovery in Vite and route manifest normalization in pure logic fed by
  Vite-discovered file IDs.
- Use `pathe` for file-ID normalization and `ufo` for route pathname shaping.
- Support `.tsx`.
- Normalize routes.
- Support `index.tsx`.
- Support `[param].tsx`.
- Support `[...slug].tsx`.
- Reserve `pages/404.tsx` and `pages/500.tsx` as root status pages.
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

- Create a new Resumable app fixture for renderer evidence. Start with
  `fixtures/minimal` using the canonical user shape:

```txt
fixtures/minimal/
  pages/
    index.tsx
  public/
  vite.config.ts
  package.json
  tsconfig.json
```

- `fixtures/minimal/vite.config.ts` must use `plugins: [qwik(), resumable()]`.
- Do not copy the hand-written Nitro ceremony from `fixtures/nitro-app`.
- One internal Nitro page renderer/dispatcher.
- Virtual or generated route manifest import.
- No Node `path`/`url` or local slash-normalization helpers in route matching;
  use `pathe` for file IDs and `ufo` for request/route pathnames.
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

### 5. Document Shell

Goal: support document customization without file-based layouts.

Build:

- Optional top-level `document.tsx`.
- `Html` component.
- Default internal document when no `document.tsx` exists.
- No document shell aliases. Top-level `app.tsx`, `root.tsx`, and `shell.tsx`
  are ignored in v0, while `pages/document.tsx` and `pages/_document.tsx`
  remain normal routes because files inside `pages/` are routes.

TDD slices:

1. Add optional top-level `document.tsx` discovery only. The first slice should use
   Vite-native lazy discovery in the existing server/client entries, pass
   `PageProps`, and render the matched page as the document child. Do not add a
   separate document virtual module, `Html`, unsupported-alias detection, or
   document attribute translation in this slice.
2. Add `Html` as its own public API slice, with focused evidence for translating
   `Html` props to Qwik SSR container attributes.
3. Do not add unsupported shell filename validation unless real user confusion
   appears. A hard error for unrelated top-level files adds ceremony, and a
   hard error for `pages/document.tsx` or `pages/_document.tsx` would violate
   the rule that `pages/` contains routes.

Exit criteria:

- Minimal starter works without `document.tsx`.
- App starter can customize `<html>`, `<head>`, and `<body>`.
- `document.tsx` can customize `<head>` from `PageProps`.
- No document shell alias behavior exists.
- `pages/document.tsx` and `pages/_document.tsx` remain normal routes.

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

### 7. Nitro Passthrough

Goal: top-level Nitro-owned app surfaces keep Nitro behavior while Resumable
owns page rendering.

Research before coding:

- Re-check Nitro v3 docs for middleware, public assets, and route rules.
- Use grep MCP for current Nitro/Vite passthrough fixture patterns.
- Run evidence through the built Nitro server entry, not only the direct
  Resumable SSR entry.

Build:

- Top-level `middleware/` runs through Nitro before page rendering.
- Top-level `middleware/` runs through Nitro before API routes.
- Top-level `public/` assets are served directly by Nitro.
- Native `nitro.routeRules` still apply.
- Existing top-level `api/` evidence remains Nitro-native.

Exit criteria:

- Middleware can add request context or headers visible from a rendered page.
- Middleware can add request context or headers visible from an API response.
- Middleware can short-circuit a request with a Nitro response.
- `public/` assets are served without rendering a Qwik page.
- `nitro.routeRules` can add headers or caching behavior to matching requests.

### 8. Typed Routing

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

### 9. SPA Navigation

Goal: `Link` can enhance navigation without changing platform semantics.

Build:

- `Link` renders an anchor.
- Navigation runtime uses the browser Navigation API.
- `@virtualstate/navigation/polyfill` provides the fallback Navigation API
  surface when `window.navigation` is missing.
- Polyfill loading is conditional and should not enable global anchor/form
  interception.
- No custom `popstate`/History API router unless the Navigation API polyfill
  cannot satisfy a required behavior.
- External links are not intercepted.
- Download/reload behavior is preserved.
- Internal page payload endpoint or renderer mode.
- Route module transition.
- Status page behavior during SPA navigation.
- Native anchors are not globally intercepted.

Exit criteria:

- App works as normal navigation without JavaScript.
- `Link` enhances internal page navigation when JavaScript is available.
- Static route priority and dynamic params match SSR behavior.

### 10. MDX Fixture And Docs Starter

Goal: prove first-class MDX before showing the Docs starter.

Build only after previous route/SSR path is stable:

- Satteri POC.
- `.mdx` page module compilation.
- Composed MDX source normalization for `--- content` and `<Content />`.
- Qwik v2-compatible output.
- Qwik optimizer compatibility.
- MDX source map/error quality.
- Docs starter.

Exit criteria:

- `pages/index.mdx` renders.
- `pages/docs/[...slug].mdx` renders.
- Qwik components can be imported inside MDX.
- Composed MDX renders the content body at exactly one visible `<Content />`
  slot in the component tree.
- Invalid Composed MDX delimiter and slot counts produce direct errors.
- ESM below `--- content` produces a direct error.
- MDX `layout` frontmatter does not create a layout wrapper.
- `.tsx` and `.mdx` route conflicts are detected.

### 11. Nitro-Owned Data Examples

Goal: prove the documented data direction without adding a Resumable data
layer.

Research before coding:

- Check Nitro v3 docs before using Nitro handler, middleware, cache, storage, or
  route-rule primitives in examples.
- Inspect Qwik async UI primitives before documenting page/component data usage.

Implementation shape:

- Keep data endpoints in top-level `api/` with native Nitro handlers.
- Keep request context in top-level `middleware/` with native Nitro middleware.
- Use Nitro route rules, storage, and cache primitives for server data behavior.
- Use Qwik primitives for async UI state.
- Keep forms pointed at real Nitro API URLs.

Exit criteria:

- Do not add public Resumable APIs for data fetching, mutation, validation,
  framework data caching, mutation refresh, or form action transport.
- Any data-focused fixture or example must use Nitro-native `api/`,
  `middleware/`, and `nitro: {}` behavior.

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
fixtures/nitro-data
fixtures/deno
fixtures/bun
```

Existing fixture:

```txt
fixtures/nitro-app
```

Use `fixtures/nitro-app` as proof that Qwik and Nitro can work together, but do
not let its hand-written ceremony leak into user templates or the new
Resumable app fixtures.

The first Resumable-owned fixture should be `fixtures/minimal`. It should prove
the canonical user-facing app shape with:

```txt
plugins: [qwik(), resumable()]
pages/index.tsx
```

It should not include user-authored `nitro()`, `resumable.config.ts`,
`nitro.config.ts`, copied Nitro server-entry ceremony, `src/pages`, or
`pages/api`.

## Implementation Guardrails

- Work test-first: failing or missing-behavior evidence comes before code.
- Keep changes surgical: one acceptance criterion or tightly related evidence
  cluster per patch.
- Prefer generated or virtual modules over user-visible generated server files.
- Do not create `resumable.config.ts`.
- Do not require `nitro.config.ts`.
- Do not wrap Qwik plugin options.
- Do not rename Nitro concepts.
- Do not implement page-local middleware.
- Do not implement file-based layouts in v0.
- Do not implement a Resumable-owned data-fetching layer.
- Do not expose prototype/unstable labels in user prompts.
- Keep errors direct and file-specific.
- Check local Qwik `build/v2`, grep MCP examples, and Nitro v3 docs before
  making Qwik/Nitro-facing implementation decisions.

## Completion Gates

Before claiming v0 core complete:

- Each completed milestone has recorded red/green evidence in `specs/state.md`.
- Each production behavior was introduced behind a focused failing test,
  fixture, type-check, or smoke verifier.
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
