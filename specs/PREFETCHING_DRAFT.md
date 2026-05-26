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
typed route -> route module -> page payload -> browser reuse
```

Generic prefetching libraries can help with heuristics, but they cannot decide
which Resumable route payloads or Qwik symbols are safe and useful to fetch.

## Draft Action Items

These are the only items currently worth carrying forward. They are still not
implementation instructions until promoted into the owning specs.

- Split prefetching into two lanes: Resumable SPA prefetch and browser document
  speculation.
- Keep v0 scoped to explicit `prefetch="intent"` unless measurements prove a
  stronger default is safe.
- Design a small Resumable scheduler before designing prediction features.
- Add route discovery as an internal concept separate from payload prefetching.
- Track Speculation Rules and `prerender_until_script`, but do not make them v0
  scope.
- Keep ForesightJS as a possible optional adapter for a future smart mode, not a
  core dependency.
- Define fixture measurements before turning this draft into implementation
  scope.

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

## Two Prefetch Lanes

Resumable should treat SPA prefetching and browser-native document speculation
as separate lanes.

```txt
Link SPA prefetch:
  Resumable owns route modules, SPA page payloads, and route-level reuse.

Browser document speculation:
  The browser owns document prefetch/prerender when a normal navigation is safe.
```

The SPA lane is core to Resumable. It is route-aware, Qwik-aware, and
framework-specific.

The browser document speculation lane is a future enhancement. It may use the
Speculation Rules API for full document navigations, especially when JavaScript
is disabled, SPA navigation is opted out, or the app intentionally wants a
browser-level prerender.

The two lanes should not be mixed casually. A `Link` prefetch should not
secretly full-prerender a document, and a browser speculation rule should not
pretend it has populated application data fetched through HTTP endpoints.

## Why Not Use A Library In Core?

### quicklink

`quicklink` is useful prior art for viewport prefetching. Its model is:

- detect links in the viewport
- wait for browser idle time
- check connection quality and data-saver state
- prefetch URLs with optional limits and throttling

That maps well to static document prefetching, but Resumable needs a
route-aware scheduler that can fetch route modules and SPA payloads without
inventing a framework-owned data cache.

### instant.page

`instant.page` is useful prior art for intent timing:

- default hover delay around 65 ms
- touch-start behavior on mobile
- mousedown mode for lower waste
- viewport modes for more aggressive prefetching
- fallback behavior for slow connections or data saver

That timing model is valuable, but the library prefetches pages, not Resumable
route payloads.

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

### Speculation Rules API

The Speculation Rules API is the main browser-level breakthrough to track.

It gives browsers a declarative way to prefetch or prerender future document
navigations using `<script type="speculationrules">` or the
`Speculation-Rules` HTTP header. This is more powerful than older document
prefetch hints, but it targets document navigations rather than framework-owned
SPA payloads.

For Resumable, this means:

- It may be valuable for normal document navigations.
- It does not replace the `Link` SPA prefetch scheduler.
- It should stay out of v0 unless a fixture proves a simple integration is safe.
- It needs CSP, browser support, analytics, side-effect, memory, CPU, and
  bandwidth guardrails before becoming a product feature.

`prerender_until_script` is especially interesting because it aims to fetch and
parse the document and discover subresources without executing JavaScript before
activation. That is philosophically aligned with Resumable, but it is still
emerging and should be tracked as a future browser speculation feature, not a v0
commitment.

## Strategy Model

Prefetching has three separate layers:

```txt
Trigger strategy  -> when a prefetch may start
Scheduler         -> which eligible prefetch runs first
Payload builder   -> what framework resources are fetched
```

Resumable may also need an internal route discovery layer:

```txt
Route discovery   -> identify route/module shape without fetching payload data
```

Route discovery is cheaper than a full prefetch. It may let Resumable learn the
matched route, generated manifest entry, and module boundary before deciding
whether data or page payload work is justified.

Do not expose a public `discover` prop in v0. Keep this internal unless real
usage proves developers need separate control.

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

Core rule from the data spec still applies:

```txt
Do not attach framework-owned data records to page payloads.
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

## Deferred Work

These items are not worth doing now:

- Full document prerendering as part of `Link` SPA prefetch.
- Speculation Rules integration in core v0.
- `prerender_until_script` integration before it is broadly available.
- `No-Vary-Search` support as a public Resumable feature.
- ForesightJS or another predictor as a core dependency.
- `prefetch="smart"`.
- Default-on prefetching.
- A public `discover` prop.

## Interaction With Data

Prefetching should not depend on a Resumable-owned data cache.

Draft behavior:

- Resumable may prefetch route modules and page payloads for SPA navigation.
- Data fetched through public HTTP endpoints follows normal HTTP and browser
  cache semantics.
- Resumable should not attach framework data records to prefetch payloads.
- Mutations posted to public HTTP endpoints do not trigger a framework-owned refresh
  protocol.

This file does not define a public data prefetch API. The first path should be
`Link` page-payload prefetching.

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
- Does page-payload prefetch stay separate from `query$` and API data
  transport?
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
