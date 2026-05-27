# Resumable Implementation State

Last updated: 2026-05-27

Status: M1 CLI create flow, M2 core Vite plugin skeleton, M3 route manifest,
M4 Qwik SSR renderer, M5 document shell, M6 status pages, and M7 Nitro
passthrough are implemented with focused red/green evidence. M7 proves that
top-level `middleware/` runs before page rendering and API routes, middleware
can short-circuit a request, `public/` assets are copied to `.output/public`
and served by the built Nitro server, native `nitro.routeRules` headers apply,
and existing API route semantics remain Nitro-owned. Route discovery belongs to
the Vite plugin instead of a Node-backed manifest scanner, environment entry
wiring uses Vite `configEnvironment()` with `consumer` and `rolldownOptions`,
and the renderer now matches static, dynamic, catch-all, 404 status, and 500
status `.tsx` page routes with `PageProps`. Top-level `document.tsx` or
`document.jsx` is discovered lazily by Vite inside the generated server/client
entries, receives `PageProps`, wraps normal, 404, and 500 pages, and the default
internal document still works without a document shell. The `Html` component is
a children-only Qwik component at runtime, while `resumable:html` uses the Vite
transform hook `filter.id` and the TSX/JSX AST to extract root `<Html>`
attributes into pre-render container attributes. Route-local `Head` is out of
v0, and document-shell aliases are intentionally not implemented. The Vite
plugin resolves Resumable virtual IDs to real `src/vite/entries/*` source files
and uses Vite dependency config to keep Qwik on one runtime instance. M8 typed
routing slice 1 now has a runtime-agnostic route declaration generator that
derives route hrefs, patterns, and param maps from the route manifest. M8 typed
routing slice 2 now emits generated Qwik JSX anchor augmentation so native
`<a>` accepts valid static hrefs and dynamic route-pattern hrefs with params,
while invalid route props fail TypeScript. M8 typed routing slice 3 now writes
`resumable-env.d.ts` and `.resumable/types/routes.d.ts` through Vite's host
filesystem so real projects discover those anchor types without manual route
imports. M8 typed routing slice 4 now lowers native route-pattern anchors to
real hrefs for SSR and client builds, preserves normal anchor props, removes
`params` before DOM output, and uses an internal route href helper for dynamic
and catch-all param encoding. M8 typed routing slice 5 now adds the typed
`Link` surface, generated `ResumableLinkProps` and
`ResumableGeneratedRoutes["link"]`, and route-pattern `Link` lowering that
reuses the native anchor route model and href helper. M9 SPA navigation is now
complete for v0 foundation scope: the public `Link` component renders a real
anchor marked for Resumable navigation, the client entry starts a Navigation API
runtime with a conditional `@virtualstate/navigation` polyfill, same-origin page
`Link` clicks transition through client route modules, native anchors stay
platform-native, and qwik-bundler route preload graph entries let Qwik preload
route and QRL chunks for SPA destinations. Scroll, focus, traversal,
success/error events, and history entry state stay delegated to the Navigation
API, while Resumable guards its own async route-module commits with
`NavigateEvent.signal`. A separate page payload endpoint or alternate SPA
renderer mode is deferred until data fetching or prefetching proves it is
needed. M10 MDX proof is now in progress: `pages/**/*.mdx` participates in the
route manifest, route typegen, server/client route discovery, and a private
Satteri-backed Vite transform. Plain MDX routes render as default-exported
Qwik-compatible page modules, Qwik components can be imported inside MDX, and
Composed MDX replaces exactly one visible `<Content />` slot with the content
body while producing direct errors for invalid delimiter/slot/binding/ESM and
frontmatter `layout` cases. The Docs starter remains intentionally unstarted.

## Current Objective

M8 typed routing and M9 SPA navigation are complete for v0 foundation scope.
M10 MDX/Composed MDX proof has started from the existing `.tsx`
route/SSR/navigation baseline. Continue M10 by hardening MDX diagnostics/source
quality and then adding the Docs starter only after the MDX fixture proof stays
green. Do not start `query$`/`action$`, prefetch scheduling, a page payload
protocol, or alternate SPA renderer mode before M10 is complete unless new
evidence changes the milestone order.

## Spec Files

- [`README.md`](./README.md): spec index and read order.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): build order,
  parallelization, guardrails, and completion gates.
- [`SPEC.md`](./SPEC.md): main framework contract.
- [`CLI_SPEC.md`](./CLI_SPEC.md): CLI/create/starter contract.
- [`TYPED_ROUTING.md`](./TYPED_ROUTING.md): typed navigation contract.
- [`DATA_FETCHING.md`](./DATA_FETCHING.md): future `query$`/`action$` data
  layer and its relationship to endpoint/middleware lifecycle files.

## Current Decisions

- Resumable is a minimal Qwik meta-framework for Vite.
- Generated apps use Vite+ for scripts and local tooling.
- User config uses explicit `qwik()` and `resumable()`.
- `resumable()` wires the internal runtime.
- `pages/` is Resumable UI routing.
- `api/` contains public HTTP endpoints that default export a function.
- `middleware/` contains request pipeline middleware that default exports a
  function.
- Endpoint cache metadata uses named sidecar exports such as
  `export const cache = { maxAge: 60 }`.
- API and middleware event typing extends the existing TypeScript plugin
  typed-source transform model used for page props.
- The same file classifier/parser should power the TypeScript plugin, Vite
  runtime wrapping, and `vp check` diagnostics.
- `public/` contains static assets.
- Data fetching direction is `schema`, `query$`, and `action$`, with no public
  `api$`, `middleware$`, `useQuery$`, `useAsync$`, or generic `handler(...)`
  helpers.
- `resumable()` exposes lazy page discovery through the internal
  `virtual:resumable/routes` module.
- `resumable()` wires Vite environment entries in `configEnvironment()` by
  reading `EnvironmentOptions.consumer`, writing
  `build.rolldownOptions.input`, and preserving explicit environment inputs.
  It keeps a minimal `ssr` environment shell because Nitro's current renderer
  service detection keys off that service environment.
- `resumable()` keeps Qwik on one Vite runtime instance by adding only
  `@qwik.dev/core` to environment `resolve.dedupe`,
  `optimizeDeps.exclude`, and server `resolve.noExternal`. This is a narrow
  Vite-native bridge until Qwik's duplicate-runtime singleton work is ready.
- Route manifest normalization consumes Vite-discovered file IDs, exposes both
  the runtime pathname and file-route pattern, uses `pathe` for file IDs and
  `ufo` for route pathnames, and avoids platform filesystem imports.
- Typed route declaration generation is pure and runtime-agnostic. It reuses the
  route manifest and emits declaration text for concrete hrefs, route patterns,
  and route param maps for `.tsx` page routes.
- The `resumable:typegen` Vite plugin writes `resumable-env.d.ts` and
  `.resumable/types/routes.d.ts` through the Vite/Rolldown host filesystem in
  `buildStart` and `watchChange`. Core Vite code does not import Node
  filesystem/path/URL helpers for typegen.
- CLI-generated apps include `resumable-env.d.ts` in `tsconfig.json` so users
  do not need manual tsconfig edits for typed routes in the default project
  shape.
- Generated route declarations also emit `ResumableStaticPageHref` and
  `ResumableAnchorProps`, then augment `@qwik.dev/core`'s
  `QwikIntrinsicElements.a` and `QwikJSX.IntrinsicElements.a`. Native anchors
  and `PropsOf<"a">` accept static app hrefs, external/hash/query hrefs, and
  asset-like hrefs without params; dynamic and catch-all file-route patterns
  require matching `params`.
- `Link` is exported from `@resumable.dev/core`, uses the same generated route
  prop model as native anchors, accepts SPA props (`prefetch`, `replace`,
  `scroll`), renders a real anchor marked with `data-resumable-link`, strips
  `params` from DOM output, and preserves native browser behavior for
  ineligible clicks.
- `Link` SPA navigation uses the browser Navigation API shape. It uses native
  `window.navigation` when available, conditionally loads
  `@virtualstate/navigation` with global interception disabled when needed, and
  does not install a custom History API router.
- `resumable()` registers route preload graph entries with qwik-bundler through
  `registerPreloadGraphEntries`, deriving route keys from manifest origins and
  leaving bundle-origin lookup/filtering to qwik-bundler.
- The `resumable:anchors` Vite transform lowers lowercase native `<a>` elements
  and imported Resumable `Link` components whose `href` is a string literal
  route pattern. It rewrites `href` to the internal
  `virtual:resumable/route-href` helper, removes the `params` prop, and leaves
  static anchors, static links, unrelated `Link` components, and expression
  hrefs alone.
- CLI path handling uses `pathe`/`ufo`; Node APIs remain only for actual
  filesystem/process CLI responsibilities.
- Route files are `.tsx` and `.mdx`.
- Composed MDX is the planned MDX layout story: explicit component tree above
  `--- content`, content body below, and one visible `<Content />` slot.
- Layouts are explicit Qwik components.
- Optional `document.tsx` or `document.jsx` owns document shell.
- Top-level `document.tsx` and `document.jsx` are the only document shell
  filenames. Top-level `app.tsx`, `root.tsx`, and `shell.tsx` are ignored in
  v0, and `pages/document.tsx` plus `pages/_document.tsx` remain normal page
  routes.
- `pages/404.tsx` is reserved by the route manifest and renders unmatched page
  requests through Qwik SSR with status 404 when present.
- `pages/500.tsx` is reserved by the route manifest and renders Qwik page render
  failures through Qwik SSR with status 500 when present.
- CLI uses `Starter`, not `Template`.
- CLI runtime/project format is separate from starter.
- Initial starters: `Minimal`, `App`, `Full-stack`.
- `Docs` starter waits for MDX and Composed MDX proof.
- `Data` does not appear as a default starter until the data layer is proven.
- Implementation must inspect local Qwik at
  `/Users/jacksm5pro/dev/open-source/qwik` on branch `build/v2`.
- Implementation should use grep MCP for non-trivial research and Nitro v3 docs
  for server/runtime behavior: https://nitro.build/docs
- Implementation must follow a TDD loop: add or identify failing evidence
  before production code, implement the smallest change, then re-run narrow
  evidence before broader checks.
- Implementation changes must stay surgical and avoid opportunistic refactors,
  dependency changes, package churn, or future-facing placeholders.
- CLI generated-app tests should use real disk destinations under `/tmp`, run
  the create flow against those destinations, and assert generated files,
  directories, contents, and forbidden paths from the filesystem.
- `fixtures/nitro-app` is reference evidence only; Resumable renderer work uses
  the Resumable-owned `fixtures/minimal` fixture with
  `plugins: [qwik(), resumable()]`.

## Milestone State

| ID  | Milestone                                 | Status   | Can Run In Parallel With         | Depends On                    |
| --- | ----------------------------------------- | -------- | -------------------------------- | ----------------------------- |
| M0  | Spec organization                         | Complete | none                             | none                          |
| M1  | CLI create flow                           | Complete | M2 package/plugin skeleton       | M0                            |
| M2  | Core Vite plugin skeleton                 | Complete | M1 CLI create flow               | M0                            |
| M3  | Route manifest                            | Complete | starter file content             | M2                            |
| M4  | Qwik SSR renderer                         | Complete | Nitro passthrough fixtures       | M2, M3                        |
| M5  | Document shell                            | Complete | status page tests                | M4                            |
| M6  | Status pages                              | Complete | M5 document shell                | M4                            |
| M7  | Nitro passthrough                         | Complete | M4 renderer work                 | M2                            |
| M8  | Typed routing                             | Complete | CLI doctor/routes commands       | M3                            |
| M9  | Link and SPA navigation                   | Complete | none                             | M4, M8                        |
| M10 | MDX/Composed MDX fixture and Docs starter | In Progress | none                          | M3, M4, Satteri/Qwik proof    |
| M11 | Data fetching prototype                   | Deferred | none                             | M4, M9, data confidence gates |
| M12 | Bun fixture                               | Deferred | CLI/runtime format work after M1 | M1, M2, M4                    |
| M13 | Deno fixture                              | Deferred | none                             | M1, M2, M4, Vite+/Deno proof  |

## Next Recommended Goal

Continue M10 from the green plain/composed MDX fixture proof:

1. Keep [`SPEC.md`](./SPEC.md) MDX and Composed MDX sections plus
   [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) M10 as the source of
   truth.
2. Harden MDX source map/error quality and any missing diagnostic edge cases
   without adding public MDX API or file-based layouts.
3. Add the Docs starter only after the MDX proof remains green.
4. Keep data fetching, prefetch scheduling, and SPA page payloads out of scope
   until M10 is complete.

Do not revisit M9 SPA internals unless the MDX fixture exposes a direct
navigation or Qwik resume regression.

## Parallel Work Notes

Good parallel slices:

- CLI prompts/templates and core plugin skeleton.
- Route manifest tests and starter file content.
- Nitro `api/`/`middleware/`/`public/` fixture and Qwik SSR renderer.
- Typed route declaration generation and JSX type augmentation after route
  manifest shape is stable.

Do not parallelize yet:

- MDX before route/SSR proves `.tsx`.
- Deno before Node/Bun-style generated app flow is stable.

## Deferred Decisions

- Whether optional `src/` source root is ever allowed.
- Whether Docs starter is visible before MDX and Composed MDX are fully proven.
- Whether Bun is v0 or waits for a fixture.
- Whether Deno is visible before a full `deno.json` fixture.
- Exact SPA page payload protocol.

## Audit Log

- Specs moved into `specs/`.
- Added this state file for `/goal` continuity.
- Added implementation plan with milestone order and parallelization.
- Added spec index/read order.
- Aligned generated config examples on `vite-plus`.
- Converted parent spec references to local links.
- Preserved data fetching as deferred design/prototype scope.
- Added implementation research requirements for local Qwik `build/v2`, grep
  MCP, and Nitro v3 docs.
- Clarified `IMPLEMENTATION_PLAN.md` to require TDD-first implementation,
  focused acceptance evidence, and surgical code changes before future M1/M2+
  work.
- Verified `/Users/jacksm5pro/dev/open-source/qwik` is on `build/v2`; inspected
  Qwik Vite plugin behavior (`qwikVite()` returns `vite-plugin-qwik`,
  `vite-plugin-qwik-post`, and an externals check) and optimizer initialization.
- Used grep MCP for current `import { nitro } from "nitro/vite"` examples and
  Nitro v3 docs/local package docs for Vite plugin, `nitro: {}` config,
  `scanDirs`, `apiDir`, middleware, and public asset behavior.
- M1/M2 red evidence: `pnpm test` failed with the CLI import executing the
  unimplemented `__VERSION__` citty stub; core tests failed because
  `resumable()` still returned Qwik plugins, returned no top-level Nitro config
  defaults, and did not reject a direct user `nitro()` plugin.
- M1/M2 green evidence: `pnpm test` passes 8 focused tests covering
  `CreateProgram` defaults, visible choices, Minimal starter output, forbidden
  generated paths, and the `resumable()`/Nitro plugin boundary.
- Broad verification passed: `pnpm format`, `pnpm check`, `pnpm test`, and
  `pnpm build`.
- Built CLI smoke passed:
  `node libs/cli/lib/index.mjs /private/tmp/resumable-m1-smoke.USHQ9X/my-app --yes --no-install --no-git`
  generated `package.json`, `vite.config.ts`, `tsconfig.json`, `README.md`,
  `pages/index.tsx`, and `public/.gitkeep`; it did not generate
  `nitro.config.ts`, `resumable.config.ts`, `src/pages`, or `pages/api`.
- M3 red evidence: first `pnpm test` failed because
  `libs/core/src/route-manifest.ts` did not exist; second `pnpm test` failed
  because bracket segments were literal routes, root `404`/`500` were normal
  routes, conflicts were not detected, `pages/api` was accepted, and non-final
  catch-all routes were accepted.
- M3 green evidence: `pnpm test` passes 16 focused tests covering top-level
  `pages/` scanning, `index.tsx`, nested `.tsx` pages, ignored top-level
  `api/`, `middleware/`, `public/`, and `src/pages`, dynamic params,
  catch-all params, root status-page manifest reservation, static and dynamic
  conflict errors, `pages/api` errors, and non-final catch-all errors.
- M3 broad verification passed: `pnpm format`, `pnpm check`, `pnpm test`, and
  `pnpm build`.
- Updated CLI test guidance after checking QwikDev Astro
  `libs/create-qwikdev-astro/tests/cli.spec.ts`: future create-flow evidence
  should run on disk under `/tmp`, clean the temporary root, invoke the real
  create flow, and assert generated paths and forbidden paths from disk.
- Updated fixture guidance: `fixtures/nitro-app` remains a Qwik+Nitro reference
  fixture, and M4 should introduce a Resumable-owned `fixtures/minimal` app
  fixture instead of copying Nitro ceremony.
- Route discovery research checked local Vite 8 plugin hook types and grep MCP
  examples from Vite/Rolldown and Hydrogen showing `import.meta.glob()` usage,
  including virtual-module-backed route file maps.
- Route discovery refactor red evidence: `pnpm test` failed 10 tests because
  `buildRouteManifestFromFileIds()` did not exist, `route-manifest.ts` still
  imported Node `fs`/`path`, and `resumable()` exposed no `resumable:routes`
  virtual module.
- Route discovery refactor green evidence: `pnpm test` passes 18 focused tests
  covering pure file-ID manifest normalization, ignored Nitro-native and
  non-canonical route directories, dynamic/catch-all/status/conflict errors,
  no Node `fs`/`path` imports in route manifest code, and an environment-agnostic
  `resumable:routes` virtual module based on
  `import.meta.glob("/pages/**/*.tsx")`.
- Route discovery refactor broad verification passed: `pnpm format`,
  `pnpm check`, `pnpm test`, and `pnpm build`.
- Added implementation-plan policy requiring `pathe` for filesystem-like paths
  and Vite file IDs, and `ufo` for URL/pathname behavior instead of hand-rolled
  slash normalization or Node `path`/`url` helpers.
- `pathe`/`ufo` audit red evidence: `pnpm test` failed 3 focused tests because
  `route-manifest.ts` did not import `pathe`/`ufo`, the Vite virtual route
  module used a local leading-slash regex, and the CLI still imported
  `node:path`/`node:url`.
- `pathe`/`ufo` audit green evidence: `pnpm test` passes 19 focused tests after
  `route-manifest.ts`, `vite.ts`, and CLI path handling use `pathe`/`ufo`; an
  audit search found no `node:path`, `node:url`, `pathToFileURL`, or
  backslash/generic-leading-slash normalization regex matches in `libs/core/src`
  or `libs/cli/src`.
- `pathe`/`ufo` audit broad verification passed: `pnpm format`, `pnpm check`,
  `pnpm test`, and `pnpm build`.
- Current `pathe`/`ufo` implementation audit:
  `libs/core/src/route-manifest.ts` uses `pathe` for Vite file IDs and `ufo`
  for route pathname shaping; `libs/core/src/vite/vite.ts` emits a virtual route
  module that uses `pathe`/`ufo` instead of a local leading-slash helper;
  `libs/cli/src/index.ts` uses `pathe`/`ufo` for create-flow path handling,
  package-name path basename extraction, and CLI file URL entrypoint parsing.
  Node imports remain in the CLI only for filesystem, child process, process,
  stdio, and test temporary-directory behavior.
- Vite plugin ceremony audit checked local Vite 8 APIs and Nitro's Vite plugin
  source. Vite exports `sortUserPlugins()`, and Nitro's `nitro()` returns a
  `Plugin[]`, which Vite accepts as a nested `PluginOption`; Resumable does not
  need a custom recursive plugin flattener or a spread of Nitro plugins.
- Vite plugin simplification red evidence: `pnpm test` failed because
  `libs/core/src/vite/vite.ts` did not use `sortUserPlugins()`, still defined
  `flattenPlugins()`, and still returned `...nitroPlugins`.
- Vite plugin simplification green evidence: `pnpm test` passes 20 focused
  tests after `libs/core/src/vite/vite.ts` uses `sortUserPlugins()`, returns Nitro's
  `Plugin[]` as a nested `PluginOption`, moves virtual route module source to a
  constant, renames helpers to direct intent names such as `createNitroConfig`
  and `throwIfUserAddedNitro`, and simplifies Nitro default merging.
  `pnpm build` reduced the packed core Vite entry from 2.67 kB to 2.18 kB.
- Added implementation-plan naming guidance for future framework glue: prefer
  direct action/object names that junior developers and AI agents can understand
  from the call site, avoid ceremonial `with*`/`handle*`/manager-style names,
  and use ownership qualifiers only when they clarify ambiguity.
- Added implementation-plan fixture QA guidance: fixture-backed behavior must
  be proven through failing red evidence first, exercised through the real app
  integration path where practical, assert both required and forbidden behavior,
  and record red/green evidence in this state file.
- M4 first-slice research verified `/Users/jacksm5pro/dev/open-source/qwik` is
  on `build/v2`, inspected Qwik `renderToString()`/`renderToStream()` server
  APIs and container attributes, and sampled grep MCP examples for Qwik SSR
  entries and Nitro/Vite usage.
- M4 first-slice red evidence: added `fixtures/minimal` with canonical
  `plugins: [qwik(), resumable()]` and a fixture-backed build/render test;
  `pnpm exec vp test fixtures/minimal/minimal.unit.ts` failed because the
  fixture had no Resumable-provided client/SSR entry and Vite tried to resolve
  the default `fixtures/minimal/index.html`. Follow-up fixture failures exposed
  that virtual document modules must not import `pathe`/`ufo` as app dependencies,
  and that the duplicate Nitro guard must tolerate Vite plugin entries without
  string names.
- M4 first-slice green evidence: `resumable()` now wires virtual client and SSR
  service entries, the SSR service imports the existing route manifest logic,
  renders the matched `/` page with Qwik `renderToString()`, and returns HTML
  with Qwik resume/runtime evidence. Core-owned helpers keep `pathe`/`ufo`
  normalization inside `@resumable.dev/core` instead of leaking those packages
  into fixture app dependencies.
- M4 first-slice verification passed:
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm test`, `pnpm format`, `pnpm check`, and `pnpm build`.
- M4 fixture QA correction: the initial fixture assertion only proved that page
  text appeared in production SSR output, which missed a dev/runtime Qwik
  `Q12` invalid HTML error where a page `<main>` rendered directly under the
  Qwik `<html>` container. Added failing evidence requiring `<main>` to render
  inside `<body>`, fixed the internal renderer to provide a default
  `<head>`/`<body>` document wrapper around page components, and moved the
  fixture-backed test out of `fixtures/minimal` into
  `libs/core/test/minimal-fixture.unit.ts` so the fixture stays user-shaped.
- Vite environment API research used grep MCP examples from Nitro and Fresh
  showing `config.consumer`/`env.config.consumer` usage, and checked local Vite
  8 types confirming `configEnvironment()` is the per-environment hook while
  `rollupOptions` is deprecated in favor of `rolldownOptions`. Local Nitro
  source confirmed its renderer service detection still depends on the `ssr`
  service environment.
- Vite environment API red evidence: `pnpm exec vp test libs/core/test/vite/vite.unit.ts`
  failed 3 tests because `resumable:vite` had no `configEnvironment()` hook,
  returned no consumer-derived environment entry config, and still used
  name-specific `createEnvironmentConfig`/`createEnvironmentWithInput` helpers
  with `rollupOptions`.
- Vite environment API green evidence: `resumable:vite` now creates only the
  minimal `ssr` environment shell needed by Nitro, then uses
  `configEnvironment()` to assign default client/server virtual entries based
  on `config.consumer` through `build.rolldownOptions.input`, preserving
  existing environment inputs and removing production `rollupOptions`
  references from `libs/core/src/vite/vite.ts`.
- Vite environment API verification passed:
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, and `pnpm build`.
- M4 static/dynamic route matching research re-verified local Qwik on
  `build/v2`, used grep MCP route matcher examples showing sorted route
  iteration and first-match behavior, and confirmed the implementation plan's
  next slice should not include document shell, status pages, typed routing, MDX,
  SPA navigation, or data APIs.
- M4 `/about` QA evidence: `fixtures/minimal/pages/about.tsx` was manually
  added before this slice. Added fixture QA for `GET /about` through the real
  built SSR entry; `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`
  passed, proving it was existing green behavior rather than new production
  implementation.
- M4 dynamic route red evidence: added `fixtures/minimal/pages/blog/test.tsx`,
  `fixtures/minimal/pages/blog/[slug].tsx`, fixture assertions for
  `GET /blog/test` and `GET /blog/hello`, and a narrow
  `matchRouteManifest()` unit test. The fixture test failed because
  `/blog/hello` returned 404, and the unit test failed because
  `matchRouteManifest` did not exist.
- M4 dynamic route green evidence: `route-manifest.ts` now exports
  `matchRouteManifest()` for sorted static-before-dynamic route matching,
  `@resumable.dev/core` exports the public `PageProps` type, and the internal
  server entry passes `{ params, url, status: 200 }` only to the matched default
  page component. `GET /blog/test` renders the static page and
  `GET /blog/hello` renders `pages/blog/[slug].tsx` with
  `props.params.slug === "hello"`.
- M4 dynamic route verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/route-manifest.unit.ts`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, and `pnpm build`.
- M4 catch-all route red evidence: added
  `fixtures/minimal/pages/docs/[...slug].tsx`, fixture QA for
  `GET /docs/guides/getting-started`, and a focused `matchRouteManifest()`
  unit case proving static routes win over dynamic routes, dynamic routes win
  over catch-all routes, catch-all params are slash-joined, and catch-all does
  not match the folder root. `pnpm exec vp test libs/core/test/route-manifest.unit.ts`
  failed because the catch-all match returned `undefined`; after rebuilding
  core for fixture package exports, `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`
  failed because the docs catch-all request returned 404.
- M4 catch-all route green evidence: `matchRouteManifest()` now handles final
  `**` segments as one-or-more remaining URL segments, captures the catch-all
  param with `ufo`'s `joinURL`, preserves static/dynamic/catch-all priority
  through manifest sort order, and still rejects the folder root. The minimal
  fixture now renders `pages/docs/[...slug].tsx` with
  `props.params.slug === "guides/getting-started"`.
- M4 catch-all route verification passed:
  `pnpm exec vp test libs/core/test/route-manifest.unit.ts`,
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, and `pnpm build`.
- M4 default-export validation evidence: added
  `fixtures/minimal/pages/missing-default.tsx` with no default export and
  fixture QA asserting `GET /missing-default` returns 500 with the direct
  message `Page module must default export a Qwik component`. The fixture test
  passed without production changes, proving the existing renderer validation
  branch through the real built SSR entry.
- M4 final verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, `pnpm build`, and
  `git diff --check`. M4 is complete enough to move to M5 Document Shell.
- M6 404 status-page mismatch audit: `pages/404.tsx` and `pages/500.tsx` were
  reserved by `buildRouteManifestFromFileIds()`, but the SSR entry still
  returned a literal `new Response("Not found", { status: 404 })` for
  unmatched page requests. grep MCP research re-checked Vite
  `configEnvironment()` and `import.meta.glob()` patterns before editing the
  Vite plugin/server-entry code.
- M6 404 red evidence: with the user-added `fixtures/minimal/pages/404.tsx`,
  added fixture QA for `GET /ccc` expecting status 404, `text/html`, and the
  rendered `404` page body with `PageProps.status === 404`,
  `PageProps.url.pathname === "/ccc"`, and empty params.
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts` failed because the
  response was still `text/plain;charset=UTF-8`.
- M6 404 green evidence: the internal server entry now routes unmatched page
  requests through `manifest.statusPages.notFound` and the same Qwik
  `renderToString()` path as normal pages, passing `PageProps` with
  `{ params: {}, status: 404 }`. After rebuilding `@resumable.dev/core`, the
  minimal fixture test passed for `GET /ccc`.
- M6 404 verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, `pnpm build`, and
  `git diff --check`.
- M6 404 query-string QA evidence: updated the existing 404 fixture to render
  `PageProps.url.search` and `PageProps.url.href`, then changed the fixture QA
  to request `GET /ccc?hello=test`. `params` stayed empty because query
  parameters are not route params, while `props.url.search` preserved
  `?hello=test`. `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`
  passed without production changes.
- M6 500 red evidence: added `fixtures/minimal/pages/500.tsx`,
  `fixtures/minimal/pages/throws.tsx`, and fixture QA for
  `GET /throws?debug=yes` expecting status 500, `text/html`, rendered `500`
  UI, `PageProps.status === 500`, the original pathname/search/href, and empty
  params. `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts` failed
  because `Fixture page render failure` bubbled out of Qwik SSR.
- M6 500 green evidence: grep MCP research re-checked Vite
  `configEnvironment()` and `import.meta.glob()` patterns before editing the
  Vite plugin/server-entry code. The internal server entry now catches normal
  page render failures and routes them through `manifest.statusPages.error`
  using the same Qwik `renderToString()` path as normal pages, passing
  `PageProps` with `{ params: {}, status: 500 }`. After rebuilding
  `@resumable.dev/core`, the minimal fixture test passed.
- M6 500 verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, `pnpm build`, and
  `git diff --check`.
- M6 Nitro API semantics red evidence: added top-level
  `fixtures/minimal/api/health.ts` and `fixtures/minimal/api/throws.ts` using
  Nitro's native `defineHandler`/`HTTPError` APIs. Added fixture QA that imports
  the built Nitro server entry `.output/server/index.mjs` in a child process and
  calls `globalThis.__nitro__.default.fetch`, proving API requests go through
  Nitro routing instead of direct `_ssr/ssr.mjs`. `GET /api/health` and
  `GET /api/throws` kept Nitro semantics, but `GET /api/missing` failed because
  it rendered Resumable's HTML 404 page instead of Nitro's JSON 404 response.
- M6 Nitro API semantics green evidence: after grep MCP re-checked Vite
  `configEnvironment()` and `import.meta.glob()` patterns and local Nitro/H3
  docs confirmed `defineHandler`/`HTTPError`, the internal SSR entry now throws
  `HTTPError.status(404)` when Nitro's catch-all renderer receives an unmatched
  `/api` request. The built Nitro entry now returns JSON 404 for
  `GET /api/missing`, preserves JSON 503 for `GET /api/throws`, preserves JSON
  200 for `GET /api/health`, and still renders page-side `404.tsx` and
  `500.tsx` for `/ccc?hello=test` and `/throws?debug=yes`.
- M6 final verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, `pnpm build`, and
  `git diff --check`. M6 is complete enough to move to M5 Document Shell.
- M5 document-shell foundation research verified
  `/Users/jacksm5pro/dev/open-source/qwik` is on `build/v2`, inspected Qwik
  `renderToString()`/`renderToStream()`, `containerAttributes`, `Slot`,
  `PropsOf`, `useServerData`, and SSR container behavior, and used grep MCP for
  current Qwik SSR `containerAttributes` examples plus Vite
  `configEnvironment()` patterns before touching `libs/core/src/vite/vite.ts`.
- M5 document-shell foundation red evidence: added fixture-backed tests outside
  the fixture. The document-less `fixtures/minimal` assertion failed because the
  default document had no charset/viewport metadata. A temporary user-shaped
  document-shell fixture under `/tmp` failed because top-level `document.tsx`
  was ignored, so document `<body>` props and shell content were absent from
  normal, 404, and 500
  responses. The Vite unit also failed because the generated server/client
  entries did not discover `/document.tsx`.
- M5 document-shell foundation green evidence was narrowed after a surgical-scope
  audit: `resumable()` uses Vite `import.meta.glob("/document.tsx")` directly in the
  generated server/client entries instead of a separate
  generated server entry, and includes `document.tsx` in the client entry.
  The server entry renders the built-in default document when no `document.tsx`
  exists, and wraps normal, 404, and 500 pages with user `document.tsx` when present.
  `Html` and root export separation were intentionally deferred into separate
  TDD slices; unsupported alias validation was later removed from v0 after
  product review.
- M5 Vite entry split follow-up: grep MCP research found modern Vite tooling
  patterns using Vite 8/Rolldown hook filters, `this.addWatchFile()`,
  `this.fs.readFile()`, and Vite-provided `transformWithOxc()` for generated TS
  or source-backed virtual modules. The accepted split is smaller:
  `src/vite/vite.ts` resolves Resumable virtual IDs to typechecked raw
  `src/vite/entries/*` source files and lets Vite own loading, transformation,
  dependency analysis, and source maps. App-root globs and Qwik runtime imports
  stay in those entry files, and reusable pure logic lives in emitted
  `src/vite/runtime/*` package subpaths.
- M5 entry-helper cleanup: grep MCP examples showed trivial `import.meta.glob`
  entry plumbing is commonly kept inline, while helpers carry lookup,
  normalization, error, or handler behavior. Removed the trivial
  `create-client-entry` and `get-app-module-loader` runtime subpaths; the
  client and document module globs now stay directly in the typed entry files.
- M5 Qwik runtime dedupe red evidence: after the entry split, the fixture tests
  failed with Qwik `Q30` duplicate-runtime errors and empty SSR bodies. A
  focused Vite unit also failed because `configEnvironment()` preserved user
  resolver config but did not add Qwik to Vite's singleton/de-optimization
  path.
- M5 Qwik runtime dedupe green evidence: `resumable:vite` now adds only
  `@qwik.dev/core` to environment `resolve.dedupe`,
  `optimizeDeps.exclude`, and server `resolve.noExternal`, while preserving
  user entries. This avoids relying on the unfinished upstream Qwik singleton
  PR.
- M5 document-shell foundation verification passed after the entry split and Qwik
  runtime dedupe fix:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm format`, `pnpm check`, `pnpm test`, `pnpm build`, and
  `git diff --check`. At that point, M5 remained active because `Html` was
  still pending. Unsupported alias validation was later removed from v0 after
  product review.
- M5 `Html` AST-transform red evidence: added focused transform tests for
  helper generation from `document.tsx` and `document.jsx`, non-`Html` roots,
  render-time local captures, and spread attributes; server-entry tests for
  pre-render `containerAttributes`; Vite plugin-order tests proving no
  plugin-level `enforce: "pre"`; and fixture evidence for request-specific
  `<html>` attributes on normal, 404, and 500 responses.
- M5 `Html` AST-transform green evidence: `Html` is a tiny runtime component
  that returns children, `resumable:html` appends
  `__resumableHtmlAttributes()` from the top-level document shell TSX/JSX AST using
  the Vite transform hook `filter.id`, and the server entry calls that helper
  before `renderToString()`. This slice uses no marker component, no
  rendered-HTML parsing, and no `html.replace()` logic. The document-shell fixture
  evidence now lives in physical `fixtures/app` with a real `document.tsx`; a narrow
  temporary fixture still proves `document.jsx`. Verification passed: red targeted
  test run, `pnpm build`, `pnpm check`,
  `pnpm test libs/core/test/minimal-fixture.unit.ts`, `pnpm test`, and
  `git diff --check`. Route-local `Head` was removed from v0: `document.tsx`
  owns `<head>` and can branch from `PageProps`.
- Test files now live in package-level `test/` folders adjacent to `src/`:
  `libs/core/test/**` and `libs/cli/test/**`. Source packages keep
  `tsconfig.json` scoped to `src`, while Vite+ still discovers tests through
  the workspace `**/*.unit.ts` pattern.
- M5 spec cleanup: product review removed unsupported document-shell alias
  validation from v0. Top-level `document.tsx` and `document.jsx` are the only
  document shell filenames; top-level `app.tsx`, `root.tsx`, and `shell.tsx`
  are ignored unless a future feature gives them meaning; and files inside
  `pages/`, including `pages/document.tsx` and `pages/_document.tsx`, remain
  normal routes. With document discovery, the default document, the `Html`
  transform, and route-local `Head` removal already implemented and verified,
  M5 is complete. The next spec-aligned implementation step is the CLI starter
  status-page path mismatch before M7 Nitro passthrough.
- CLI starter status-page path red evidence: added a real create-flow test for
  App and Full-stack starters expecting `pages/404.tsx` and `pages/500.tsx`
  with no top-level `404.tsx` or `500.tsx`.
  `pnpm exec vp test libs/cli/test/index.unit.ts` failed because
  `pages/404.tsx` was missing.
- CLI starter status-page path green evidence: App and Full-stack now generate
  `pages/404.tsx` and `pages/500.tsx`, and generated `tsconfig.json` includes
  `pages`, `document.tsx`, and `vite.config.ts` without top-level status-page
  entries. Focused CLI verification passed with
  `pnpm exec vp test libs/cli/test/index.unit.ts`.
- CLI starter status-page path broad verification passed: `pnpm check`,
  `pnpm test`, `pnpm build`, and `git diff --check`.
- Spec audit aligned `IMPLEMENTATION_PLAN.md` with the milestone table by
  adding M7 Nitro Passthrough before Typed Routing and renumbering the later
  build-order sections.
- API/middleware naming research: grep MCP examples show handler-shaped API
  and middleware files are common, but generic `handler(...)` is ambiguous for
  juniors and agents. After auditing the existing TypeScript plugin's
  `getScriptSnapshot` typed-source transform, the public direction shifted to
  plain default exports in `api/` and `middleware/`, with runtime
  implementation kept internal and advanced runtime details documented
  separately.
- API/data DX direction updated: keep `schema`, `query$`, and `action$` as the
  future data layer direction; use plain default exports for public HTTP and
  request lifecycle files; do not add public `api$`, `middleware$`,
  `useQuery$`, `useAsync$`, or generic `handler(...)` helpers.
- M7 research re-checked Nitro v3 docs and local package docs for middleware,
  lifecycle, public assets, route rules, and Vite/Nitro server behavior. Grep
  MCP examples from Nitro's repo and public Vite/Nitro apps confirmed
  `middleware: true`, `routeRules`, `publicAssets`, `defineMiddleware`, and
  `nitro()` usage in Nitro-native terms.
- M7 red evidence: added built-server fixture evidence for top-level
  middleware, public assets, and native route rules, then
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts` failed because
  `.output/public/resumable-m7.txt` did not exist yet.
- M7 green evidence: the focused built-server test creates a temporary Nitro
  passthrough fixture with native `middleware/00.request.ts`,
  `api/middleware-context.ts`, `public/resumable-m7.txt`, and
  `nitro.routeRules` in `vite.config.ts`. This keeps the persistent Minimal
  fixture editor-clean while still proving middleware headers on page responses,
  middleware context in an API route, middleware short-circuiting, public asset
  copy/serving, and route-rule headers. No Resumable API/middleware wrapper or
  additional runtime abstraction was needed.
- M7 broad verification passed: `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check`.
- M8 route type generation red evidence: `pnpm exec vp test libs/core/test/route-types.unit.ts libs/core/test/minimal-fixture.unit.ts`
  failed because `../src/route-types.ts` did not exist and the fixture had no
  generated route env file.
- M8 route type generation green evidence: added a pure
  `createRouteTypesDeclaration()` generator that emits concrete hrefs, dynamic
  route patterns, route params, external hrefs, and asset hrefs from the route
  manifest. Physical file writing was intentionally removed from
  `@resumable.dev/core/vite`; the remaining file-production step must be
  host-owned and runtime-agnostic.
- M8 JSX anchor augmentation research checked local Qwik `build/v2` types and
  grep MCP examples. Qwik exposes JSX native tag types through
  `QwikJSX.IntrinsicElements`, while `PropsOf<"a">` reads
  `QwikIntrinsicElements["a"]`.
- M8 JSX anchor augmentation red evidence:
  `pnpm exec vp test libs/core/test/route-types.unit.ts` failed because native
  Qwik `<a>` did not accept a `params` prop and invalid route hrefs were not
  rejected by TypeScript.
- M8 JSX anchor augmentation green evidence: generated route declarations now
  import `QwikHTMLElements`, export `ResumableStaticPageHref` and
  `ResumableAnchorProps`, and augment both Qwik anchor type surfaces so native
  anchors and `PropsOf<"a">` accept valid static hrefs plus dynamic/catch-all
  route patterns with matching `params`. The in-memory TSX evidence proves
  unknown routes, missing dynamic params, wrong param names, and params on
  static routes fail type-checking. Fixture language-service evidence also
  proves normal Qwik anchor props such as `onClick$`, `target`, and `rel` still
  complete after typed static and dynamic hrefs.
- M8 JSX anchor broad verification passed:
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/route-types.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts libs/cli/test/index.unit.ts`,
  `pnpm exec vp check`, `git diff --check`, and an audit search for direct
  Node filesystem/path imports or write helpers in the core route-types path.
- M8 host typegen research used grep MCP for Vite plugin host filesystem
  examples and local Vite/Rolldown types for plugin-context `this.fs`. Decision:
  keep the route declaration generator pure, and isolate physical
  `resumable-env.d.ts` plus `.resumable/types/routes.d.ts` writes behind the
  Vite/Rolldown host filesystem instead of importing Node filesystem helpers in
  core Vite code.
- M8 host typegen red evidence:
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts -t "generates route declarations"`
  failed after fixture build because the temporary app did not contain
  `resumable-env.d.ts`.
- M8 host typegen green evidence: `resumable:typegen` scans `pages/` through
  the Vite host filesystem in `buildStart` and `watchChange`, writes
  `resumable-env.d.ts` and `.resumable/types/routes.d.ts`, and a temporary
  fixture project type-checks native anchors without importing generated route
  types. The project TypeScript evidence covers valid static hrefs, valid
  dynamic route-pattern hrefs with params, unknown routes, missing params,
  wrong param names, and params on static routes.
- M8 host typegen broad verification passed:
  `pnpm exec vp test libs/core/test/route-types.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/vite/vite.unit.ts libs/core/test/minimal-fixture.unit.ts libs/cli/test/index.unit.ts`,
  `pnpm exec vp check`, `pnpm --filter @resumable.dev/core build`,
  `pnpm --filter @resumable.dev/cli build`, `git diff --check`, and an audit
  search found no direct Node filesystem/path/URL imports in the core Vite
  typegen path.
- M8 dynamic href completion red evidence:
  `pnpm --filter @resumable.dev/typescript-plugin proof` failed because bare
  native `<a href="">` completions did not include `"/blog/[slug]"`. The
  generated anchor type was correct, but TypeScript's JSX completion filtered
  out dynamic route-pattern branches until `params` already existed.
- M8 dynamic href completion green evidence: the TypeScript plugin now appends
  dynamic file-route patterns to native `<a href="">` completions from the
  configured `pages/` tree without weakening generated anchor types. Direct
  language-service proof returns `"/blog/[slug]"`, and tsserver proof returns
  `"/blog/[slug]"` plus `"/docs/[...slug]"`.
- M8 dynamic href completion verification passed:
  `pnpm --filter @resumable.dev/typescript-plugin proof`, `pnpm exec vp check`,
  and `git diff --check`.
- M8 native anchor lowering red evidence:
  `pnpm exec vp test libs/core/test/vite/anchor-transform.unit.ts libs/core/test/minimal-fixture.unit.ts -t "anchor|lowers route-pattern"`
  failed before implementation because `anchor-transform.ts` and the href
  helper did not exist, and the temporary fixture still rendered
  `href="/blog/[slug]"` plus a leaked `params` attribute in SSR output.
- M8 native anchor lowering green evidence: `resumable:anchors` runs as a Vite
  transform with `order: "pre"` and `filter.id` for JSX/TSX files, discovers
  routes through the existing Vite host filesystem page discovery, lowers native
  route-pattern `<a>` elements to `__resumableHref(...)`, and removes `params`.
  The internal `virtual:resumable/route-href` entry encodes dynamic params as
  one URL segment, encodes catch-all params segment-by-segment, and throws a
  direct Resumable error for empty catch-all values. Unit evidence covers
  preserved normal props, static/expression href no-ops, unknown route-pattern
  errors, missing params, wrong object-literal params, param encoding, and empty
  catch-all errors.
- M8 native anchor lowering fixture evidence: a temporary built fixture renders
  `/links` SSR output with concrete `href="/blog/hello%20world"`,
  `href="/blog/a%2Fb"`, and `href="/docs/guides/getting%20started"` values,
  preserves normal anchor props such as `class`, `data-*`, `target`, and `rel`,
  and does not emit `params=`. The client build output also contains the
  transformed helper path and omits `params=`, proving the transform applies to
  both SSR and client builds. A separate temporary fixture proves invalid
  route-pattern anchors fail the Vite build with a direct `Typed route error`.
- M8 native anchor lowering verification passed:
  `pnpm exec vp test libs/core/test/vite/anchor-transform.unit.ts libs/core/test/vite/vite.unit.ts libs/core/test/route-types.unit.ts libs/core/test/route-manifest.unit.ts libs/core/test/minimal-fixture.unit.ts`,
  `pnpm exec vp check`, `pnpm --filter @resumable.dev/core build`, and
  `git diff --check`.
- M8 typed `Link` research checked local Qwik `build/v2` component and JSX
  types. `PropsOf<COMP>` reads a function/component prop type, and public Qwik
  `Link`-like examples use normal component props plus `<Slot />` when a Qwik
  component boundary is needed. Grep MCP examples across Next/TanStack-style
  links reinforced keeping Resumable's public shape anchor-like with `href`
  instead of introducing a router-object API.
- M8 typed `Link` red evidence:
  `pnpm exec vp test libs/core/test/route-types.unit.ts` failed because the
  generated route declarations did not emit `ResumableLinkProps` and
  `@resumable.dev/core` did not export `Link`; `pnpm exec vp test
libs/core/test/vite/anchor-transform.unit.ts` failed because imported
  Resumable `Link` route patterns were not lowered or rejected.
- M8 typed `Link` green evidence: generated route declarations now export
  `ResumableLinkProps`, augment `ResumableGeneratedRoutes["link"]`, and let
  imported `Link` usages type-check with the same static href, dynamic params,
  catch-all params, and invalid-route failures as native anchors. The public
  `Link` function component renders a real `<a>` and strips `params`,
  `prefetch`, `replace`, and `scroll` from DOM output until M9 adds runtime SPA
  behavior. The Vite transform now lowers imported Resumable
  `Link` route patterns through `__resumableHref(...)`, preserves normal anchor
  props and future SPA props for the runtime surface, ignores unrelated
  `Link` components, and leaves static links unchanged.
- M8 typed `Link` fixture evidence: a temporary built fixture type-checks
  static and route-pattern `Link` usages through generated project
  declarations, renders `/links` SSR output with
  `href="/blog/link%20post"`, preserves `class` and `data-*`, omits `params=`,
  and keeps a static `<Link href="/about">` as a normal anchor. Client build
  output includes the transformed route-pattern values and omits `params=`.
- M8 typed `Link` verification passed:
  `pnpm exec vp test libs/core/test/route-types.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/anchor-transform.unit.ts`,
  `pnpm --filter @resumable.dev/core build`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`, and
  `git diff --check`.
- M9 first-slice research inspected local Navigation API usage patterns with
  grep MCP and kept the runtime on the platform-shaped Navigation API instead
  of adding a Resumable History API router.
- M9 first-slice green evidence: `Link` now renders a real anchor marked with
  `data-resumable-link`; the client entry starts
  `__resumableStartSpaNavigation`; the runtime uses native
  `window.navigation` when present and conditionally applies
  `@virtualstate/navigation` with `interceptEvents: false`; same-origin page
  `Link` clicks call `navigation.navigate(...)`; native anchors are not
  intercepted; route updates dispatch through Qwik state instead of wrapper DOM
  replacement.
- M9 preload graph evidence: Resumable registers page route preload graph
  entries with qwik-bundler through `registerPreloadGraphEntries`. The
  generated minimal fixture manifest has `/links` as a route preload key and
  reaches the counter QRL chunk, and browser QA showed the counter QRL was
  already fetched before the counter click.
- M9 hardening evidence: focused SPA navigation tests now cover same-origin
  `Link` enhancement, native-anchor pass-through, external origins,
  non-primary/modifier clicks, `target != "_self"`, `download`,
  `rel="external"`, `replace`, `scroll={false}`, back/forward traverse
  handling for known routes, and leaving unmatched/status-page fallback paths
  to document navigation.
- M9 browser QA evidence: the built minimal fixture showed SPA `Link`
  navigation from `/about` to `/links` with no document request, the `Links`
  counter click made no new network request after route preload, browser back
  and forward traversed between `/about` and `/links` without document
  requests, and a native anchor from `/` to `/links` still made a document
  request.
- M9 platform-delegation audit: MDN Navigation API docs confirm that scroll,
  focus, traversal, success/error events, and history entry state are platform
  responsibilities for SPA navigation. Resumable should delegate those through
  `NavigateEvent.intercept(...)`, `event.hashChange`, and `NavigateEvent.signal`
  instead of adding custom scroll restoration, focus management, `popstate`
  handling, or a History API router.
- M9 stale-navigation red evidence: the focused SPA navigation unit test failed
  because an aborted slow route module still dispatched after a faster later
  navigation
  (`["pages/fast.tsx", "pages/slow.tsx"]` instead of only
  `["pages/fast.tsx"]`).
- M9 stale-navigation green evidence: route rendering now receives
  `NavigateEvent.signal` and checks it before starting side effects and again
  after async page/document module loading. Focused SPA tests now pass and cover
  hash-only navigation pass-through, platform `focusReset`/`scroll` intercept
  options, stale async commit prevention, ineligible `Link` clicks, native
  anchor pass-through, back/forward traverse, and status-page fallback policy.
- M9 hardening verification passed: focused SPA navigation tests, the combined
  SPA/route-manifest/Vite/minimal fixture test run,
  `pnpm --filter @resumable.dev/core build`, and
  `pnpm --dir fixtures/minimal build`.
- M9 browser QA evidence after stale-navigation hardening: the built minimal
  fixture showed SPA `Link` navigation from `/about` to `/links` with no
  document request and no console/page errors; browser back returned to
  `/about` without a document request and forward returned to `/links` with no
  requests; a native anchor from `/` to `/links` still made a document request;
  and a temporary hash link reached `/links#hash-target` without a document
  request or browser errors.
- M9 final completion audit: the current client route-module transition is the
  accepted v0 SPA renderer mode. A separate page payload endpoint or alternate
  SPA renderer mode is deferred until data fetching or prefetching proves it is
  needed. The no-JavaScript fallback criterion is proven by SSR fixture output
  that renders `Link` as real `<a>` elements with concrete `href` values and
  `data-resumable-link` enhancement markers, and by no-JavaScript browser QA
  where clicking a `Link` from `/about` to `/links` made a document request.
  Browser QA also separately proves native anchors still perform document
  navigation. M9 is complete; prefetch scheduling, MDX, and data fetching remain
  out of M9.
- M10 research evidence: inspected local Qwik `build/v2` MDX implementation
  (`packages/qwik-router/src/buildtime/markdown/mdx.ts`,
  `frontmatter.ts`, and `mdx.unit.ts`). Qwik compiles MDX with
  `jsxImportSource: "@qwik.dev/core"` and wraps generated MDX content as a
  default page component. Inspected `https://github.com/bruits/satteri` and
  Satteri `0.6.3`; its public API provides `mdxToJs()`, `mdxToMdast()`,
  `defineMdastPlugin()`, mdast/hast plugin hooks, Qwik-compatible
  `jsxImportSource`, and frontmatter output. grep MCP found no existing public
  `mdxToJs(` or `from "satteri"` usage patterns, so local source and Satteri
  docs drove the integration.
- M10 red evidence: route-manifest tests failed because `.mdx` routes were
  ignored and `.tsx`/`.mdx` conflicts did not throw; the temporary plain MDX
  fixture rendered `/` as 404; the Composed MDX unit suite exposed a missing
  direct error for `import { Content }`.
- M10 green evidence: `.mdx` page routes now use the same manifest, route
  typegen, server/client route discovery, and route conflict rules as `.tsx`.
  The private `resumable:mdx` Vite plugin compiles Satteri MDX to
  Qwik-compatible default page modules before Qwik's post transform. Plain MDX
  temporary fixtures prove `pages/index.mdx`, `pages/docs/[...slug].mdx`, and
  imported Qwik components render through SSR. Composed MDX fixture evidence
  proves the content body renders between shell content before and after the
  visible `<Content />` slot.
- M10 direct-error evidence: focused MDX transform tests cover multiple
  `--- content` delimiters, zero slots, multiple slots, importing `Content`,
  defining `Content`, ESM below `--- content`, and frontmatter `layout`.
- M10 verification passed: `pnpm exec vp test libs/core/test/vite/mdx.unit.ts`,
  `pnpm exec vp test libs/core/test/route-manifest.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/route-typegen.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/vite.unit.ts`,
  `pnpm exec vp test libs/core/test/route-types.unit.ts`,
  `pnpm exec vp test libs/core/test/vite/anchor-transform.unit.ts`,
  `pnpm exec vp test libs/core/test/minimal-fixture.unit.ts`,
  `pnpm --filter @resumable.dev/core build`, and
  `pnpm --dir fixtures/minimal build`. M10 remains In Progress because the Docs
  starter and MDX source-map/error-quality polish remain outside this slice.
