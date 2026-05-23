# Resumable Prefetching Draft

Status: Exploratory draft - do not implement directly

Parent specs:

- [`TYPED_ROUTING.md`](./TYPED_ROUTING.md)
- [`DATA_FETCHING.md`](./DATA_FETCHING.md)

This document captures the current prefetching direction for Resumable. It is
not an implementation contract, milestone, or acceptance checklist.

Implementation agents must not build from this file until the ideas here are
promoted into the typed routing, data fetching, or implementation plan specs.

## Purpose

Prefetching in Resumable should make SPA navigation feel immediate without
turning every link into background work.

The framework-specific problem is larger than generic URL prefetching:

```txt
typed route -> route module -> page payload -> query record deltas -> browser reuse
```

Generic prefetching libraries can help with heuristics, but they cannot decide
which Resumable route payloads, Qwik symbols, or query records are safe and
useful to fetch.

## Draft Decision

Resumable should roll its own core prefetch scheduler.

Existing libraries should be treated as prior art. They should not be required
dependencies for the core `Link` runtime.

Core rule:

```txt
Libraries can inspire when to prefetch.
Resumable must own what and how to prefetch.
```

The v0 public API should remain the small surface already sketched in typed
routing:

```ts
type PrefetchMode = false | true | "intent" | "viewport";
```

Future experimental modes can be explored later:

```ts
type FuturePrefetchMode = "smart" | "press";
```

Those modes are intentionally not part of the current typed routing API.

## Why Not Use A Library In Core?

### quicklink

`quicklink` is useful prior art for viewport prefetching. Its model is:

- detect links in the viewport
- wait for browser idle time
- check connection quality and data-saver state
- prefetch URLs with optional limits and throttling

That maps well to static document prefetching, but Resumable needs a
route-aware scheduler that can fetch route modules, SPA payloads, and query
deltas without sending data the browser already has.

### instant.page

`instant.page` is useful prior art for intent timing:

- default hover delay around 65 ms
- touch-start behavior on mobile
- mousedown mode for lower waste
- viewport modes for more aggressive prefetching
- fallback behavior for slow connections or data saver

That timing model is valuable, but the library prefetches pages, not Resumable
route payloads and query deltas.

### ForesightJS

ForesightJS is the strongest candidate for a future optional adapter because it
separates prefetching into three questions:

```txt
what to load
how to load/cache it
when to start
```

ForesightJS focuses on the `when`, using signals such as mouse trajectory,
keyboard navigation, scroll direction, and touch intent. That matches
Resumable's needs better than a URL prefetcher.

It should still stay optional. Its prediction layer can trigger Resumable's
own prefetch callback, but it should not own Resumable's route/data semantics.

## Strategy Model

Prefetching has three separate layers:

```txt
Trigger strategy  -> when a prefetch may start
Scheduler         -> which eligible prefetch runs first
Payload builder   -> what framework resources are fetched
```

### Trigger Strategy

`intent`:

- Start after likely user intent.
- Desktop signals: hover, focus, pointer movement settling over the link.
- Touch signals: `touchstart` or equivalent pointer start.
- Keyboard users must be included through focus or future predictor support.
- Use a small delay before hover-triggered prefetching.

`viewport`:

- Start when a `Link` enters the viewport.
- Use `IntersectionObserver`.
- Prefer idle time when the navigation is not clearly imminent.
- Avoid unlimited list/table prefetching.

`true`:

- Alias for the default eager strategy once that strategy is finalized.
- Draft preference: treat as `intent` in v0 if implemented, not viewport.

`false`:

- Never prefetch this link.

### Scheduler

The scheduler should be tiny and framework-owned.

Draft behavior:

- Skip prefetching when the rendered link would not be SPA-intercepted.
- Skip when the user has enabled reduced data usage.
- Avoid prefetching on very slow network conditions when detectable.
- Cap concurrency, likely at one or two prefetches.
- Keep a small priority queue.
- Prioritize links with active user intent over viewport-only links.
- Let newer intent replace older speculative work.
- Drop viewport work when a link scrolls away before it starts.
- Reuse an in-flight prefetch if the user clicks the link.
- Abort or deprioritize work that is no longer relevant.
- Avoid duplicate prefetches for the same route payload key.

### Payload Builder

The payload builder is Resumable-specific and must not be delegated to a
generic prefetching package.

A link prefetch may need:

- the resolved concrete href
- the matched page route
- the generated route manifest entry
- the route module or Qwik symbols needed for the destination
- the SPA page payload endpoint
- query records needed by the destination
- only missing, stale, or newer query records

Core rule from the data spec still applies:

```txt
Send query deltas, not a dehydrated client cache.
```

## Default Behavior

Default prefetching should stay conservative until measured.

Draft preference:

```txt
v0 implementation: require explicit prefetch
future default: intent, if fixture metrics support it
```

This keeps the product story aligned with the README language:

```txt
work runs only when your users care
```

`intent` is the best semantic fit for that story. `viewport` can feel fast but
is easier to waste, especially in lists, menus, docs sidebars, dashboards, and
search results.

## Link Eligibility

A `Link` should only be eligible for prefetching when it would also be eligible
for SPA interception.

Do not prefetch when:

- the href is external
- the href does not map to a Resumable page route
- `reload` is set
- `download` is set
- `target` is present and not `_self`
- `rel="external"` is present
- the prefetch mode is `false`
- the route payload cannot be safely represented as a resumable SPA payload

Native `<a>` elements are not a prefetch surface in this draft.

## Cache Keys

The prefetch cache key must include enough information to avoid reusing stale
or mismatched work.

Likely inputs:

- concrete href
- route manifest version
- build id or asset version
- locale/base path, if supported
- relevant search params
- relevant query identities and input hashes
- query freshness metadata

The exact key format is intentionally not specified yet.

## Interaction With Query Records

Prefetching should reuse the browser query cache from the data fetching spec.

Draft behavior:

- If a destination needs a fresh query record already present in the browser,
  do not request it again.
- If a destination needs a missing query record, include it in the page payload
  delta.
- If a destination needs a stale query record, request a newer record.
- If a mutation refreshes a query, invalidate or refresh matching prefetched
  payloads.
- Failed query records need a separate policy before implementation.

This file does not decide whether Resumable exposes a public query prefetch API.
The first path should be `Link` page-payload prefetching.

## Future Smart Prefetch

A future experimental mode could look like:

```tsx
<Link href="/dashboard" prefetch="smart">
  Dashboard
</Link>
```

Possible implementation:

```txt
@resumable.dev/prefetch-smart -> ForesightJS adapter -> Resumable prefetch callback
```

Rules for a smart adapter:

- It may decide when to call `prefetch(href)`.
- It must not fetch resources directly.
- It must not bypass Resumable's scheduler.
- It must respect reduced-data settings.
- It must be easy to remove without changing the core runtime.

This is not v0 scope.

## Measurement Requirements Before Promotion

This draft should not become implementation scope until fixture measurements
can answer:

- How much does `intent` reduce navigation latency?
- How often does `intent` prefetch a route the user does not visit?
- How much waste does `viewport` create in lists and docs nav?
- Does prefetching route payloads duplicate Qwik's own symbol prefetching?
- Can in-flight prefetch promotion reliably reduce click-to-render delay?
- Do query deltas stay smaller than full page cache hydration?
- Does the scheduler respect reduced-data and slow-connection constraints?

## Promotion Checklist

Before implementation, move the accepted decisions out of this draft and into
the owning specs:

- Public API changes go in [`TYPED_ROUTING.md`](./TYPED_ROUTING.md).
- Query-delta behavior goes in [`DATA_FETCHING.md`](./DATA_FETCHING.md).
- Milestone and fixture work goes in
  [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

This draft should then either be deleted or changed to historical research.

## References

- Next.js prefetch scheduling:
  https://nextjs.org/docs/app/guides/prefetching
- SvelteKit link preload options:
  https://svelte.dev/docs/kit/link-options
- TanStack Router preloading:
  https://tanstack.com/router/latest/docs/framework/react/guide/preloading
- Qwik speculative module fetching:
  https://qwik.dev/docs/advanced/speculative-module-fetching/
- quicklink:
  https://github.com/GoogleChromeLabs/quicklink
- instant.page intensity:
  https://instant.page/intensity
- ForesightJS:
  https://foresightjs.com/docs/getting-started/what-is-foresightjs/
