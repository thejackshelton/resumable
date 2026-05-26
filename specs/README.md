# Resumable Specs

Status: Draft

This folder is the authoritative spec set for Resumable. Future implementation
work should start here instead of reading the root directory for scattered
documents.

## Read Order

1. [`state.md`](./state.md)
2. [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
3. [`SPEC.md`](./SPEC.md)
4. [`CLI_SPEC.md`](./CLI_SPEC.md)
5. [`TYPED_ROUTING.md`](./TYPED_ROUTING.md)
6. [`DATA_FETCHING.md`](./DATA_FETCHING.md)

Exploratory drafts are intentionally excluded from this read order. They are
research notes, not implementation scope.

`state.md` is the current execution state for `/goal` work. It should be kept
short and updated when a milestone starts, finishes, or is intentionally
deferred.

`IMPLEMENTATION_PLAN.md` is the build guide. It does not replace the product
specs; it tells an implementation agent what to build first, what can happen in
parallel, and which parts are deferred.

## Research Requirements

Implementation agents must work from current sources, not memory.

- Inspect the local Qwik repository at
  `/Users/jacksm5pro/dev/open-source/qwik` before implementing Qwik-facing
  behavior.
- Verify that the local Qwik repository is on branch `build/v2` before relying
  on it.
- Use the local Qwik source to confirm available Qwik v2 core APIs, server
  rendering APIs, JSX types, optimizer behavior, and Vite plugin behavior.
- Use grep MCP during implementation planning and before non-trivial framework
  decisions to compare real public implementations and patterns.
- Use Nitro v3 docs as the server/runtime reference:
  https://nitro.build/docs

Do not rely on old `@builder.io/qwik` examples as authoritative for public
Resumable examples. Resumable docs and generated code should use
`@qwik.dev/core`.

## Spec Roles

- [`SPEC.md`](./SPEC.md): main framework contract for positioning, project
  structure, routing, document shell, MDX, runtime relationship, rendering,
  HTTP endpoints, middleware, public assets, and v0 acceptance.
- [`CLI_SPEC.md`](./CLI_SPEC.md): create flow, starters, runtime/project format,
  Vite+ command surface, and CLI architecture.
- [`TYPED_ROUTING.md`](./TYPED_ROUTING.md): typed anchors, `Link`, route type
  generation, generated declarations, JSX lowering, and navigation acceptance.
- [`DATA_FETCHING.md`](./DATA_FETCHING.md): future data layer direction for
  `schema`, `query$`, `action$`, native typed forms, query records, cache
  semantics, SPA reuse, and the relationship with `api/` and `middleware/`
  lifecycle files.

## Exploratory Drafts

- [`PREFETCHING_DRAFT.md`](./PREFETCHING_DRAFT.md): prefetching research and
  direction. Do not implement directly from this file.

## Non-Negotiable Boundaries

```txt
Pages are Resumable.
Components are Qwik.
API and middleware are Resumable request lifecycle files.
Configuration is Vite.
Tooling is Vite+.
```

- Qwik's Vite plugin stays explicit in user config.
- `resumable()` wires the internal runtime.
- `api/` contains public HTTP endpoints.
- `middleware/` contains request pipeline middleware.
- API files default export a function.
- Middleware files default export a function.
- Endpoint cache metadata uses named sidecar exports such as
  `export const cache = { maxAge: 60 }`.
- A shared file classifier/parser powers the TypeScript plugin, Vite wrapping,
  and `vp check` diagnostics.
- `public/` contains static assets.
- `pages/` is Resumable-owned UI routing.
- No `resumable.config.ts`.
- No documented `nitro.config.ts` requirement for generated apps.
- No public `server/api/` or `server/middleware/` app shape.
- No `src/pages/` requirement.
- No `pages/api/`.

## Audit Notes

The specs were reorganized into this folder together. During the move:

- Cross-spec parent references were converted to relative links.
- Generated app config examples were aligned on `vite-plus`.
- CLI wording was aligned on `Starter` instead of `Template`.
- Project/runtime format and starter choice were kept as separate CLI axes.
- Data fetching remains design direction and prototype scope, not first
  milestone implementation scope. Public `api$`, `middleware$`, `useQuery$`,
  generic `handler(...)`, and required `endpoint(...)`/`middleware(...)`
  wrappers are not part of that direction.
- Implementation agents must consult local Qwik `build/v2`, grep MCP research,
  and Nitro v3 docs before changing Qwik/Nitro-facing implementation details.
