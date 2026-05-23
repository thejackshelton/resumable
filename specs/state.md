# Resumable Implementation State

Last updated: 2026-05-23

Status: M1 CLI create flow, M2 core Vite plugin skeleton, and M3 route
manifest are implemented with focused red/green evidence. Route discovery now
belongs to the Vite plugin instead of a Node-backed manifest scanner.

## Current Objective

Move next to the Qwik SSR renderer without expanding into app shell rendering,
typed routing, MDX, SPA navigation, or data/form APIs.

## Spec Files

- [`README.md`](./README.md): spec index and read order.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): build order,
  parallelization, guardrails, and completion gates.
- [`SPEC.md`](./SPEC.md): main framework contract.
- [`CLI_SPEC.md`](./CLI_SPEC.md): CLI/create/starter contract.
- [`TYPED_ROUTING.md`](./TYPED_ROUTING.md): typed navigation contract.
- [`DATA_FETCHING.md`](./DATA_FETCHING.md): future data layer contract.

## Current Decisions

- Resumable is a minimal Qwik meta-framework for Vite, powered by Nitro.
- Generated apps use Vite+ for scripts and local tooling.
- User config uses explicit `qwik()` and `resumable()`.
- `resumable()` wires Nitro internally.
- App-level Nitro config stays in top-level `nitro: {}`.
- `pages/` is Resumable UI routing.
- `api/`, `middleware/`, and `public/` are Nitro-native.
- `resumable()` exposes lazy page discovery through the internal
  `virtual:resumable/routes` module.
- Route manifest normalization consumes Vite-discovered file IDs, uses `pathe`
  for file IDs and `ufo` for route pathnames, and does not import Node `fs` or
  `path`.
- CLI path handling uses `pathe`/`ufo`; Node APIs remain only for actual
  filesystem/process CLI responsibilities.
- Route files are `.tsx` and, after proof, `.mdx`.
- Layouts are explicit Qwik components.
- Optional `app.tsx` owns document shell.
- Root `404.tsx` and `500.tsx` are supported.
- CLI uses `Starter`, not `Template`.
- CLI runtime/project format is separate from starter.
- Initial starters: `Minimal`, `App`, `Full-stack`.
- `Docs` starter waits for MDX proof.
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
- `fixtures/nitro-app` is reference evidence only; Resumable renderer work
  should create a new Resumable-owned fixture such as `fixtures/minimal` with
  `plugins: [qwik(), resumable()]`.

## Milestone State

| ID  | Milestone                    | Status   | Can Run In Parallel With         | Depends On                    |
| --- | ---------------------------- | -------- | -------------------------------- | ----------------------------- |
| M0  | Spec organization            | Complete | none                             | none                          |
| M1  | CLI create flow              | Complete | M2 package/plugin skeleton       | M0                            |
| M2  | Core Vite plugin skeleton    | Complete | M1 CLI create flow               | M0                            |
| M3  | Route manifest               | Complete | starter file content             | M2                            |
| M4  | Qwik SSR renderer            | Pending  | Nitro passthrough fixtures       | M2, M3                        |
| M5  | App shell and Head           | Pending  | status page tests                | M4                            |
| M6  | Status pages                 | Pending  | M5 app shell                     | M4                            |
| M7  | Nitro passthrough            | Pending  | M4 renderer work                 | M2                            |
| M8  | Typed routing                | Pending  | CLI doctor/routes commands       | M3                            |
| M9  | Link and SPA navigation      | Pending  | none                             | M4, M8                        |
| M10 | MDX fixture and Docs starter | Pending  | none                             | M3, M4, Satteri/Qwik proof    |
| M11 | Data fetching prototype      | Deferred | none                             | M4, M9, data confidence gates |
| M12 | Bun fixture                  | Deferred | CLI/runtime format work after M1 | M1, M2, M4                    |
| M13 | Deno fixture                 | Deferred | none                             | M1, M2, M4, Vite+/Deno proof  |

## Next Recommended Goal

Start M4 in TDD slices:

1. Re-verify local Qwik `build/v2` server rendering APIs.
2. Add failing renderer tests or a minimal fixture using the M3 manifest.
3. Implement the smallest internal Nitro page dispatcher/renderer.
4. Keep app shell, status-page rendering, typed routing, MDX, SPA navigation,
   and data/form APIs out of the first renderer slice.

Before coding M4 or any Qwik-facing runtime code, verify the local Qwik repo is
still on branch `build/v2` and inspect the relevant core/server/Vite plugin
APIs. Use grep MCP for comparable public implementation patterns.

## Parallel Work Notes

Good parallel slices:

- CLI prompts/templates and core plugin skeleton.
- Route manifest tests and starter file content.
- Nitro `api/`/`middleware/`/`public/` fixture and Qwik SSR renderer.
- Typed route declaration generation and JSX type augmentation after route
  manifest shape is stable.

Do not parallelize yet:

- MDX before route/SSR proves `.tsx`.
- Data fetching before SSR render context and SPA payload exist.
- Deno before Node/Bun-style generated app flow is stable.

## Deferred Decisions

- Whether optional `src/` source root is ever allowed.
- Whether Docs starter is visible before MDX is fully proven.
- Whether Bun is v0 or waits for a fixture.
- Whether Deno is visible before a full `deno.json` fixture.
- Exact generated route type file location.
- Exact SPA page payload protocol.
- Public `query$`/`action$` release timing.

## Audit Log

- Specs moved into `specs/`.
- Added this state file for `/goal` continuity.
- Added implementation plan with milestone order and parallelization.
- Added spec index/read order.
- Aligned generated config examples on `vite-plus`.
- Converted parent spec references to local links.
- Preserved data fetching as deferred implementation direction, not immediate
  v0 core scope.
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
  for route pathname shaping; `libs/core/src/vite.ts` emits a virtual route
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
  `libs/core/src/vite.ts` did not use `sortUserPlugins()`, still defined
  `flattenPlugins()`, and still returned `...nitroPlugins`.
- Vite plugin simplification green evidence: `pnpm test` passes 20 focused
  tests after `libs/core/src/vite.ts` uses `sortUserPlugins()`, returns Nitro's
  `Plugin[]` as a nested `PluginOption`, moves virtual route module source to a
  constant, renames helpers to direct intent names such as `createNitroConfig`
  and `throwIfUserAddedNitro`, and simplifies Nitro default merging.
  `pnpm build` reduced the packed core Vite entry from 2.67 kB to 2.18 kB.
- Added implementation-plan naming guidance for future framework glue: prefer
  direct action/object names that junior developers and AI agents can understand
  from the call site, avoid ceremonial `with*`/`handle*`/manager-style names,
  and use ownership qualifiers only when they clarify ambiguity.
