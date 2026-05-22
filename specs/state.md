# Resumable Implementation State

Last updated: 2026-05-22

Status: Spec organization complete; ready for implementation planning goals.

## Current Objective

Audit the existing specs, keep them together under `specs/`, create an
implementation plan, and maintain this state file so future `/goal` work can
resume without re-deciding the framework direction.

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

## Milestone State

| ID  | Milestone                    | Status   | Can Run In Parallel With         | Depends On                    |
| --- | ---------------------------- | -------- | -------------------------------- | ----------------------------- |
| M0  | Spec organization            | Complete | none                             | none                          |
| M1  | CLI create flow              | Pending  | M2 package/plugin skeleton       | M0                            |
| M2  | Core Vite plugin skeleton    | Pending  | M1 CLI create flow               | M0                            |
| M3  | Route manifest               | Pending  | starter file content             | M2                            |
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

Start M1/M2 in parallel-friendly slices:

1. Align `libs/cli` package direction with `@resumable.dev/cli`.
2. Implement `CreateProgram` lifecycle and Minimal starter.
3. Implement `resumable()` Vite plugin skeleton.
4. Add a minimal generated-app fixture that uses `qwik()` and `resumable()`.

Before coding M2 or any Qwik-facing runtime code, verify the local Qwik repo is
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
