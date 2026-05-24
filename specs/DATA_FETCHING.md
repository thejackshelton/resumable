# Resumable Data Fetching Specification

Status: Draft

Parent spec: [`SPEC.md`](./SPEC.md)

Implementation owner: `@resumable.dev/core`, with compiler and manifest support
from the `resumable()` Vite plugin.

## Decision

Resumable should provide a built-in data layer based on three primitives:

```txt
schema   -> optional Standard Schema handler argument/return-value contract
query$   -> cached read function with stable identity
action$  -> mutation or side effect that can refresh queries
```

The data layer is optional. A Resumable app can still use plain async functions,
direct `fetch`, or native Nitro routes. `schema`, `query$`, and `action$` exist
for shared typed server functions where validation, request dedupe, caching,
serialization, SPA reuse, or post-mutation refresh are worth the extra
structure.

`query$` is not a route loader and not a general server function. It is a read
contract. Resumable can validate it, dedupe it, cache it, serialize it once, and
reuse it across SSR and SPA navigation.

`action$` is for writes and side effects. Actions are not cached by default.
They may request query refreshes after successful mutations.

The handler signature is:

```txt
handler(argument, ctx)
```

The first argument, when present, is query or action input. The second argument
is request/runtime context. Simple handlers do not need to name either argument
when they are unused.

`schema` is optional. It exists for data boundaries where runtime validation,
type inference, JSON Schema export, or agent-readable contracts matter. Simple
queries and actions should not need schemas.

Core rule:

```txt
Need a data boundary? Use schema.
Need data? Use query$.
Need to change something? Use action$.
Need async UI state? Use Qwik useAsync$.
Need fallback UI? Use Qwik Suspense.
```

## Naming

Use `schema`, `query$`, and `action$`.

Avoid `read$` and `write$`.

`query$` is the better name for reads because it implies query identity,
deduping, freshness, prefetching, and cache reuse. `read$` sounds like a direct
database or filesystem operation and does not naturally imply a framework query
cache.

`action$` is the better name for writes because mutations are not always simple
writes. They can log in, send an email, upload a file, start a checkout, call a
third-party API, or refresh cached data after a successful change.

Avoid exposing `server$` as the primary Resumable data API. `server$` is too
broad. `query$` and `action$` communicate intent, which lets Resumable make
stronger decisions about caching, serialization, refresh, SPA reuse, and safety.

`schema` is the better name for handler argument and return-value contracts
because it says what the primitive is instead of leaking option names like
`input` and `output` into every configured query. It should accept Standard
Schema-compatible validators and should not be tied to Zod or any single schema
library.

Do not call this primitive `schema$` in v0. The `$` suffix should stay reserved
for executable Qwik boundaries that the optimizer can QRL-extract, such as
`query$` and `action$`. A schema contract is data, not a callback boundary.

### API Naming Decision

Keep `query$` and `action$`.

Grep MCP research did not find a better fit for Resumable's data API:

- Qwik City uses `routeLoader$` and `routeAction$`, which validates the `$`
  suffix for Qwik-tracked lazy boundaries but keeps those primitives
  route-bound.
- Qwik City also uses `server$`, and Next/Solid examples use `"use server"`,
  but those names are too broad for a Resumable data cache. They do not say
  whether a function is a cached read, a side effect, or a refresh boundary.
- Solid Router uses `query(...)` and `action(...)`, and pRPC has `query$(...)`
  examples. These are closest to the Resumable mental model.
- TanStack Start uses `createServerFn(...).inputValidator(...).handler(...)`.
  That shape is powerful, but it reads like generic server execution and adds
  more ceremony than Resumable should require for junior developers and AI
  agents.
- Remix, React Router, and SvelteKit use route-local `loader`/`load` plus
  `action`/`actions`. Those names are familiar, but they imply route modules,
  not reusable query contracts that can be called from pages, components, SSR,
  SPA navigation, and prefetch.
- Astro uses `defineAction(...)`, but that pattern is action-only and
  registry/config shaped. It is not a good read-side cache API.

Do not rename the primitives to `defineQuery$` or `defineAction$` in v0.
`define*` reads like route or server infrastructure and makes the data API feel
closer to Nitro/H3 handler registration. The useful boundary is:

```txt
Need UI data with cache/reuse semantics? Use query$.
Need a mutation or side effect? Use action$.
Need public HTTP or middleware? Use Nitro defineHandler/defineMiddleware.
```

## Research Baseline

Grep MCP research found these relevant patterns:

- Solid Start uses `query(...)` for reads and `action(...)` for writes.
- Remix uses `loader` for reads and `action` for writes.
- SvelteKit uses `load` for reads and `actions` for writes.
- Qwik City uses `routeLoader$` for route-bound reads and `routeAction$` for
  route-bound writes.
- TanStack Start uses compiler-backed `createServerFn(...)` for server
  execution and commonly combines router loaders with
  `queryClient.ensureQueryData(...)`.
- TanStack Query users get value from query identity, request dedupe,
  stale/fresh behavior, invalidation, SSR reuse, and SPA cache reuse.
- TanStack Query SSR uses `QueryClientProvider`, dehydration, hydration, and
  hydration/query boundaries.
- SvelteKit remote functions use user-facing refresh language such as
  `query.refresh()` and `requested(query).refreshAll()` for post-command query
  updates.
- Nuxt uses `refreshNuxtData(...)` and `clearNuxtData(...)` around async data
  keys.
- Nitro exposes cached functions and storage primitives that Resumable can use
  instead of inventing a parallel server cache.
- H3 has Standard Schema validation utilities, which makes schema-backed query
  and action handler argument validation a good fit for the Nitro stack.
- Standard Schema exposes a small shared validator interface plus input and
  output inference helpers, which makes library-agnostic validation possible.
- Standard JSON Schema can describe argument and return-value contracts for docs,
  OpenAPI, tool manifests, and AI agent understanding when the underlying
  schema library can export it.
- Qwik City has validator helpers such as `zod$` and `validator$`, but
  Resumable should keep `schema` library-agnostic and Standard Schema-based.
- Qwik v2 makes `useAsync$` the async state primitive. `<Suspense>` controls
  fallback UI; it does not fetch data.
- Qwik City route loaders and Nitro/H3 handlers expose request state through an
  explicit event argument.
- Astro actions use an explicit `(input, context)` handler shape.
- TanStack Start server functions and real-world usage separate validated
  `data` from middleware-provided `context`.
- SvelteKit remote functions use `getRequestEvent()`, but that hides request
  state behind a global helper and has timing and route-context caveats.

Resumable should borrow the query identity and cache semantics people like from
TanStack Query, but implement them through Qwik resumability and Nitro instead
of a client query provider and hydration boundary.

## Mental Model

TanStack-style model:

```txt
server/loader fetches data
query client stores records
server dehydrates query client
client hydrates query client
components read through query hooks
```

Resumable model:

```txt
query$ defines a read contract
Nitro executes and caches it
Qwik useAsync$ turns it into async UI state
Qwik serializes the resolved state
Resumable resumes and reuses query records during SPA navigation
```

No `QueryClientProvider` is required.

No `HydrationBoundary` is required.

No `useQuery` hook is required.

## Public API

The public package entrypoint is:

```ts
import { action$, query$, schema } from "@resumable.dev/core";
```

Do not require users to learn a separate `/data` subpath for the primary data
primitives. The package may keep internal modules split for implementation and
tree-shaking, but the documented API should be imported from
`@resumable.dev/core`.

Canonical shapes:

```ts
schema(contract);

query$(handler);
query$(handler, options);

action$(handler);
action$(handler, options);
```

Simple reads and writes pass the function directly:

```ts
export const getPosts = query$(async () => {
  return db.posts.findMany();
});

export const ping = action$(async () => {
  return { ok: true };
});
```

Configured reads and writes keep the handler first in v0:

```ts
query$(handler, options);
action$(handler, options);
```

This is a v0 decision. Qwik's `$` APIs are optimized around a lazy-loadable
first argument. `query$` and `action$` need the handler to be that first
argument so the Qwik optimizer can turn it into a QRL without Resumable
inventing second-argument compiler magic.

An options-first API would read well:

```ts
query$(options, handler);
```

But it would require Qwik optimizer support for a second-argument QRL, a
Resumable-specific pre-transform, or explicit lower-level APIs. That tradeoff is
not worth taking in v0. The added transform surface would become a permanent
compiler contract for import tracking, aliases, source maps, error locations,
SSR/client bundle separation, and interaction order with the Qwik optimizer.

If Qwik later supports declaring which argument is the implicit QRL, Resumable
can revisit options-first without custom compiler behavior.

Do not document or require these shapes:

```ts
query$(options, handler);
action$(options, handler);
```

The options object should stay small and opinionated. It is not a general
Nitro-cache configuration surface and should not become a junk drawer.

Initial `query$` options:

```ts
type QueryOptions<Input, Output> = {
  schema?: Schema<Input, Output>;
  cache?: QueryCache;
};

type Duration = `${number}${"ms" | "s" | "m" | "h" | "d"}`;

type QueryCache = false | Duration | PrivateCache | PublicCache;

type PrivateCache = {
  private: Duration;
  public?: never;
  stale?: never;
};

type PublicCache = {
  public: Duration;
  stale?: Duration;
  private?: never;
};
```

Meaning:

- `schema` validates the handler argument and return value.
- `cache: "5m"` is shorthand for private browser query freshness.
- `cache: { private: "5m" }` is explicit private browser query freshness.
- `cache: { public: "5m" }` enables shared Nitro durable caching for data safe
  to share across users.
- `cache: { public: "5m", stale: "1h" }` enables shared Nitro durable caching
  with stale-while-revalidate behavior.

`private` and `public` cache modes are mutually exclusive. A query cache option
must not specify both.

Do not expose a user-facing query key in v0. Resumable should generate query
identity internally, following the same broad precedent as Qwik Router
`routeLoader$`: users declare a function, and the framework assigns the stable
internal id used by the manifest and runtime.

Avoid exposing lower-level fields such as `staleTime`, `maxAge`, `scope`,
`storage`, `strategy`, or `id` in v0. Those names are useful internally and in
Nitro configuration, but the Resumable query API should present one small
`cache` concept.

Do not include tag-based invalidation in v0. Tags are powerful, but they are
stringly typed and easy for junior developers or AI agents to invent
inconsistently. Prefer action-side refresh by query symbol first.

### Qwik Optimizer Constraint

The trailing options object is a deliberate exception to ideal API aesthetics.
Qwik's `implicit$FirstArg` convention means a function ending in `$` treats its
first argument as the lazy-loadable QRL expression:

```ts
query$(handler, options);
```

is optimizer-friendly because `handler` is first.

```ts
query$(options, handler);
```

is not optimizer-friendly because the lazy server handler is second.

Resumable should not require junior developers or AI agents to know when to
manually wrap a handler with `$()`, and it should not add custom
second-argument QRL behavior in v0.

This is possible by changing the Qwik optimizer or by adding a Resumable
pre-transform before Qwik runs. It is still deferred because the cleaner version
is upstream Qwik support for non-first-argument implicit QRLs, not framework
specific compiler behavior.

The concern is not that compiler pattern matching is always bad. Qwik already
uses a simple pattern:

```txt
$-suffixed API -> first argument is QRL-extracted
```

That rule is explicit, deterministic, and easy to teach. The v0 data API should
avoid an API-specific exception such as:

```txt
most $ APIs -> first argument is QRL-extracted
query$/action$ -> second argument is QRL-extracted when options are first
```

That kind of exception makes the compiler contract harder for junior developers
and AI agents to predict.

`schema` deliberately does not use a `$` suffix. It is a normal contract helper,
not an executable lazy boundary.

### Future Upstream Optimizer Direction

Options-first is worth exploring as an upstream Qwik optimizer feature, not as a
Resumable-only transform.

The useful primitive is not a global heuristic like "if there are two
arguments, extract the second." It would need to be explicit marker metadata,
conceptually:

```ts
implicit$FirstArg(queryQrl);
implicit$OptionalFirstArg(queryQrl);
```

The strategy would be:

```txt
query$(handler)           -> extract argument 0
query$(options, handler)  -> extract argument 1
```

That can be deterministic if the marker declares the strategy. It is still a
Qwik language-design decision because it changes the teachable rule from:

```txt
$-suffixed API -> first argument is QRL-extracted
```

to:

```txt
$-suffixed API -> the marker declares which argument is QRL-extracted
```

Resumable v0 should not depend on this. If Qwik later accepts a marker strategy
for optional config-first APIs, Resumable can add support and provide a codemod
from `query$(handler, options)` to `query$(options, handler)`.

### Rejected v0 Alternative: Options-First Transform

Resumable should not ship a Vite pre-transform that rewrites this:

```ts
query$(options, handler);
```

into this:

```ts
queryQrl($(handler), options);
```

That approach preserves a cleaner call shape, but it makes data fetching depend
on Resumable-specific compiler behavior. For v0, reliability and predictable
Qwik compatibility are more important than avoiding a trailing options object.

The options-first API can be reconsidered if one of these becomes true:

- Qwik adds upstream support for non-first-argument implicit QRLs.
- Handler-first causes real type inference problems with `schema`.
- The data API becomes important enough to justify owning the transform surface.

### Queries

Minimal query:

```ts
import { query$ } from "@resumable.dev/core";

export const getPosts = query$(async () => {
  return db.posts.findMany();
});
```

Configured query:

```ts
import { query$, schema } from "@resumable.dev/core";
import { z } from "zod";

export const PostBySlug = schema({
  input: z.object({
    slug: z.string()
  }),
  output: z.object({
    title: z.string(),
    body: z.string()
  })
});

export const getPost = query$(
  async ({ slug }) => {
    return db.posts.findBySlug(slug);
  },
  {
    schema: PostBySlug,
    cache: { public: "5m", stale: "1h" }
  }
);
```

The exported query is callable. A query call returns a promise for the validated
output, not a Qwik resource object:

```ts
const post = await getPost({ slug: "hello" });
```

In these examples, `slug` is only query input. It commonly comes from route
params:

```txt
route params -> query input -> query handler
```

For example, `pages/blog/[slug].tsx` may call:

```ts
getPost({ slug: props.params.slug });
```

The query handler then receives the validated input object. A second `ctx`
parameter should only appear when the handler needs request/runtime state.

### Runtime Context

Query and action handlers may receive a second context argument:

```ts
import type { H3Event } from "nitro/h3";

type QueryContext = {
  event: H3Event;
  signal: AbortSignal;
};

type ActionContext = QueryContext & {
  refresh: RefreshQuery;
};
```

`ctx.event` is the native Nitro/H3 event. Resumable should not wrap Nitro's
request model in a parallel abstraction.

Applications should be able to augment the event context type through a global
app type, so middleware-provided values are typed in queries and actions:

```ts
declare module "@resumable.dev/core" {
  interface AppContext {
    user?: {
      id: string;
      email: string;
    };
  }
}
```

Conceptually:

```ts
type QueryContext<Context = AppContext> = {
  event: H3Event & { context: Context };
  signal: AbortSignal;
};
```

Use context for request/runtime state:

```ts
export const getCurrentUser = query$(async (_, ctx) => {
  return getUserFromSession(ctx.event);
});
```

Use the handler argument for data dependencies that affect query identity,
dedupe, caching, refresh, or SPA reuse:

```ts
export const getPost = query$(async ({ slug }, ctx) => {
  const user = await getUserFromSession(ctx.event);

  return db.posts.findVisibleToUser(slug, user.id);
});
```

In a page, route params are passed into the query explicitly:

```ts
getPost({ slug: props.params.slug });
```

Core rule:

```txt
query/action data dependency -> handler argument
request/runtime state        -> ctx
Nitro escape hatch           -> ctx.event
action refresh               -> ctx.refresh(...)
```

Even shorter:

```txt
If it changes what data is returned, pass it as the argument.
If it describes the current request, use ctx.
```

What goes where:

| Value                        | Put it in                   |
| ---------------------------- | --------------------------- |
| Route params                 | query/action argument       |
| Search params                | query/action argument       |
| Form values                  | action argument             |
| Selected UI state            | query/action argument       |
| Cookies                      | `ctx.event`                 |
| Headers                      | `ctx.event`                 |
| Auth/session from middleware | `ctx.event.context`         |
| Runtime config               | Nitro helper or `ctx.event` |
| Abort/cancel                 | `ctx.signal`                |
| Refresh reads after mutation | `ctx.refresh(...)`          |

Do not add a Resumable `ctx.params` shortcut in v0. Nitro's
`ctx.event.context.params` remains available as part of the raw Nitro event, but
page route params that affect a query result should be passed as query input.
Otherwise, the query cache cannot distinguish `getPost` on `/blog/one` from
`getPost` on `/blog/two`.

Future guardrail: development builds should warn when a public cached query
reads request-specific state such as cookies, auth/session context, or
`ctx.event.context.params` without an explicit safe partition. This protects
against accidental cross-user cache leaks while keeping v0's public API small.

In Qwik UI, use `useAsync$` when rendered UI depends on async query state:

```tsx
import { component$, Suspense, useAsync$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";
import { getPost } from "../../data/posts";

export default component$((props: PageProps) => {
  const post = useAsync$(({ abortSignal }) =>
    getPost({ slug: props.params.slug }, { signal: abortSignal })
  );

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <h1>{post.value.title}</h1>
    </Suspense>
  );
});
```

Inline loading and error states are also valid Qwik:

```tsx
if (post.loading) {
  return <p>Loading...</p>;
}

if (post.error) {
  return <p>Failed to load post.</p>;
}

return <h1>{post.value.title}</h1>;
```

### Actions

Minimal action:

```ts
import { action$ } from "@resumable.dev/core";

export const ping = action$(async () => {
  return { ok: true };
});
```

Configured action:

```ts
import { action$, schema } from "@resumable.dev/core";
import { z } from "zod";

export const UpdatePost = schema({
  input: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string()
  }),
  output: z.object({
    ok: z.boolean()
  })
});

export const updatePost = action$(
  async ({ id, slug, title }, ctx) => {
    await db.posts.update(id, { title });

    ctx.refresh(getPost, { slug });
    ctx.refresh(getPosts);

    return { ok: true };
  },
  {
    schema: UpdatePost
  }
);
```

Actions should be used for mutations and side effects. They should not be
deduped or cached like queries.

### Action Refresh

Actions refresh queries by code symbol, not by string tag:

```ts
ctx.refresh(getPost, { slug });
ctx.refresh(getPosts);
```

Meaning:

```txt
ctx.refresh(getPost, { slug }) -> refresh getPost({ slug })
ctx.refresh(getPosts)          -> refresh all known records for getPosts
```

The refresh API should be queued while the action runs and applied only after
the action succeeds. If the action throws, queued refreshes are discarded.

The public word is `refresh`, not `invalidate`. Internally, Resumable may mark
records stale, refetch active records, clear browser records, and purge matching
Nitro public cache entries. The public API should describe the developer's
intent: the reads affected by this successful write should be refreshed.

## Standard Schema

`schema` defines an optional handler argument and return-value contract:

```ts
const Contract = schema({
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
});
```

The actual type name does not need to be public API, but the accepted validator
shape should be Standard Schema-compatible.

`schema` is optional and should not be required for simple queries or actions.
When present, it should:

- infer the handler input type from `input`;
- infer the public return type from `output`;
- validate query and action inputs before the handler runs;
- validate outputs before data is serialized or returned to the browser;
- produce direct errors for invalid inputs;
- treat invalid output as a server bug, especially in development.

`schema` should be library-agnostic. Zod, Valibot, ArkType, or any other
Standard Schema-compatible validator should work if it implements the Standard
Schema interface.

Standard JSON Schema export can be added for tooling and documentation when the
underlying schema library supports it. JSON Schema export is useful for OpenAPI,
tool manifests, docs, and AI agent understanding. Validation should still be
performed by the Standard Schema validator.

The Vite plugin should be allowed to keep heavy validators out of client bundles
where possible. Client code needs the typed callable query or action. Server
validation and JSON Schema generation can remain server-side implementation
details unless a specific client-side validation feature requires them.

## Query Identity

Every query has a stable internal identity. Users should not need to name query
keys for ordinary apps.

Default identity:

```txt
generated query id
```

The Vite plugin should generate or record this id from stable build-time
information such as the QRL hash, file path, export name, or manifest entry. The
exact mechanism can change during implementation, but the public model should
stay:

```txt
exported query function -> internal query id
```

This matches the useful part of Qwik Router's `routeLoader$` model. A loader has
an internal id, but developers normally do not write a cache key. Resumable
queries should feel the same.

Query cache identity is:

```txt
internal query id + canonical validated input
```

Example:

```txt
q_abc123 + {"slug":"hello"}
```

`routeLoader$` can avoid input hashing because it is route-scoped and
request-scoped. `query$` is reusable and parameterized, so two calls to the same
query with different inputs need separate records:

```ts
getPost({ slug: "hello" });
getPost({ slug: "world" });
```

The Vite plugin should generate or record the query manifest so the runtime can
map browser calls to server handlers without requiring users to maintain a
separate registry. If manifest generation produces duplicate internal ids,
Resumable should fail the build with a direct framework error.

## Query Records

A resolved query should be represented as a query record:

```ts
interface QueryRecord<T> {
  readonly id: string;
  readonly inputHash: string;
  readonly status: "success" | "error";
  readonly data?: T;
  readonly error?: unknown;
  readonly updatedAt: number;
  readonly expiresAt?: number;
}
```

The exact internal shape can change, but Resumable needs an explicit query
record model so SSR, Qwik serialization, SPA navigation, and Nitro cache
integration all agree on identity.

## Cache Layers

Resumable should use three cache layers:

```txt
Request query cache
Browser query cache
Nitro durable cache
```

### Request Query Cache

The request query cache is scoped to one SSR render or one route payload
request.

If multiple components call the same query with the same validated input during
one render, Resumable should execute the handler once and return the same
in-flight promise to all callers.

When the promise resolves, all callers should observe the same resolved object
reference. This lets Qwik's serializer represent the result once instead of
serializing duplicate copies for each component that asked for the same data.

### Browser Query Cache

The browser query cache is framework-owned and resumable.

It should store query records by query identity. During SPA navigation,
Resumable should reuse fresh records and avoid refetching identical data.

This cache should not require a provider or user-created query client.

### Nitro Durable Cache

Durable cache uses Nitro storage and cache primitives.

Durable cache must be explicit. The default query behavior should be request
dedupe and SPA reuse, not public cross-user persistence.

Recommended initial cache modes:

```txt
omitted                    -> request dedupe and serialized page-state reuse
false                      -> request dedupe only
"5m"                       -> private browser freshness for five minutes
{ private: "5m" }          -> explicit private browser freshness
{ public: "5m" }           -> shared Nitro cache for data safe across users
{ public: "5m", stale }    -> shared Nitro cache with stale-while-revalidate
```

`stale` is the public Resumable term for the additional window where stale data
may be served while a fresh value is recomputed. Internally, public cache maps
to Nitro storage/cache primitives, including Nitro's SWR behavior. Resumable
should keep the query API smaller than Nitro's full cache surface. Users who
need advanced server behavior can still use native Nitro handlers, storage, or
route rules directly.

Do not expose raw Nitro cache options on `query$` in v0:

```txt
maxAge
staleMaxAge
swr
base
name
group
getKey
integrity
shouldBypassCache
shouldInvalidateCache
```

Nitro owns durable cache mechanics and storage backends. Resumable owns query
identity, private browser freshness, action refresh behavior, and the decision
to opt a query into Nitro-backed public caching.

User-scoped and tenant-scoped durable caching can be added later once the cache
partition API is clear. Do not add them to v0's query options prematurely.

## Serialization And SPA Reuse

Resumable should not copy TanStack Query's hydration model.

TanStack Query uses a query client that is dehydrated on the server and hydrated
on the client.

Resumable should instead let Qwik serialize resolved async state and framework
query records as part of the resumable app state.

The public API should not add separate serialization options. Query and action
handler arguments and return values should follow Qwik serialization semantics.
Resumable owns query identity, dedupe, freshness, and cache record metadata;
Qwik owns value serialization.

If a public Nitro durable cache is used, Resumable should cache a
framework-owned serialized query record or payload, not expose Nitro's JSON cache
serialization as the public data model.

On SSR:

- Query calls execute directly on the server through Nitro context.
- Duplicate query calls share one in-flight promise.
- Resolved query records are attached to the render context.
- Qwik serializes the async state needed by the rendered page.

On SPA navigation:

- `Link` may request a page payload.
- The page payload may include a query record delta.
- The client merges only missing, stale, or newer query records.
- Existing fresh query records are reused.
- The payload should not resend the entire browser query cache.

Core rule:

```txt
Send query deltas, not a dehydrated client cache.
```

## Transport

Developers should not choose HTTP methods for `query$`.

`query$` is semantically an idempotent read. The internal transport is a
framework detail.

During SSR, query calls should execute directly without an HTTP round trip.

In the browser, query calls should go through an internal Nitro route or RPC
entrypoint. Resumable may use `GET` when the input is URL-safe and useful for
HTTP caching. It may use `POST` for complex serialized inputs. Either way, the
query contract remains read-only.

`action$` is the mutation primitive and should use mutation-appropriate
transport.

## Progressive Forms

Resumable should support progressive form submissions by enhancing native HTML
form attributes, not by introducing a primary `Form` component.

Native HTML already has `action` on `<form>` and `formAction` on submit
buttons. Resumable should extend the Qwik JSX types so those attributes accept
`action$` symbols in addition to normal string URLs:

Beginner example:

```ts
import { action$ } from "@resumable.dev/core";

export const contact = action$(async ({ email, message }) => {
  await sendContactEmail({ email, message });

  return { ok: true };
});
```

```tsx
import { contact } from "../data/contact";

export default component$(() => {
  return (
    <form method="post" action={contact}>
      <input name="email" type="email" />
      <textarea name="message" />
      <button>Send</button>
    </form>
  );
});
```

Intermediate example:

```tsx
import { updatePost, deletePost } from "../data/posts";

export default component$((props: PageProps<{ id: string }>) => {
  return (
    <form method="post" action={updatePost}>
      <input type="hidden" name="id" value={props.params.id} />
      <input name="title" />

      <button>Save</button>
      <button formAction={deletePost}>Delete</button>
    </form>
  );
});
```

The same action remains callable programmatically:

```ts
await updatePost({ id, title });
```

The Vite plugin and runtime should lower action symbols to real POST URLs before
they reach the DOM:

```tsx
<form method="post" action={updatePost}>
```

becomes:

```html
<form method="post" action="/_resumable/actions/..." />
```

and:

```tsx
<button formAction={deletePost}>Delete</button>
```

becomes:

```html
<button formaction="/_resumable/actions/...">Delete</button>
```

Core rule:

```txt
action$ defines the mutation.
Native form action/formAction submits it progressively.
```

This mirrors typed routing:

```txt
<a href="/blog/[slug]" params={{ slug }}> -> typed native navigation
<form action={updatePost}>                -> typed native mutation
```

No primary `<Form>` component is needed in v0. Wrapper components conflict with
form libraries and UI kits, and they make the native platform behavior less
obvious for junior developers and AI agents.

The rendered form must work without JavaScript. With JavaScript, Resumable may
progressively enhance submission for pending state, response merging, query
refresh, and SPA-friendly updates. Enhancement must preserve browser semantics
when disabled or unavailable.

Transform and validation requirements:

- Type-check native `<form action>` and `<button formAction>` against known
  `action$` exports.
- Preserve normal string `action` and `formAction` URLs.
- Render action symbols as concrete URLs on the server.
- Use `method="post"` for action submissions; `method="get"` with an `action$`
  value should produce a direct dev/build error.
- Preserve normal form props such as `class`, `target`, `enctype`, `aria-*`,
  `data-*`, and event handlers.
- Preserve button props and only lower `formAction` values that reference
  `action$` symbols.
- Do not require JavaScript for successful form submission.
- Do not require a Resumable-specific form component.

Form values become the action handler argument. If a schema is present, it
validates the form-derived argument before the handler runs. File upload support
depends on the action schema and transport accepting `FormData`, `File`, or
`Blob`; detailed file semantics can be finalized separately.

`schema` is the shared data boundary for programmatic action calls and native
form submissions. Do not add a separate form-only schema primitive.

Core rule:

```txt
schema validates the data boundary.
action$ runs the mutation.
native form action sends FormData into the same action.
```

One action should work from both call sites:

```ts
await contact({ email, message });
```

```tsx
<form method="post" action={contact}>
  <input name="email" type="email" />
  <textarea name="message" />
  <button>Send</button>
</form>
```

FormData mapping:

```txt
field name       -> action argument object key
repeated fields  -> array value
file fields      -> File value
missing fields   -> omitted key
schema           -> validation and coercion
```

This keeps Resumable compatible with form libraries. Form libraries can own
client field state, client validation UI, dirty/touched tracking, reset policy,
and optimistic UI. Resumable owns the action transport, server-side schema
validation, action result, and query refresh after success.

Do not add a `useFormAction()` hook or form-state framework in v0. General UI
state should use Qwik primitives, action promises, and form libraries.

## Error And Status Model

Query and action data should be returned. Request failure and HTTP control flow
should be thrown.

Core rule:

```txt
return data        -> successful query or action result
return null        -> valid empty data state
throw HTTPError    -> HTTP failure handled by Nitro/H3
throw unknown      -> unexpected 500
```

Use Nitro's H3 exports for HTTP failures:

```ts
import { HTTPError } from "nitro/h3";
import { query$ } from "@resumable.dev/core";

export const getPost = query$(async ({ slug }) => {
  const post = await db.posts.findBySlug(slug);

  if (!post) {
    throw HTTPError.status(404, "Post not found");
  }

  return post;
});
```

Resumable v0 should not add aliases such as `httpError()` or `notFound()` unless
they add real Qwik/page semantics beyond Nitro. A thrown Nitro/H3 `404` should
be enough for Resumable's page renderer to use `pages/404.tsx` when rendering a
page request.

Validation behavior:

- `schema` handler argument validation failure should produce a direct
  client-input error, usually `400 Bad Request` or `422 Unprocessable Entity`.
- `schema` handler return-value validation failure is a server bug and should
  become a 500, especially loudly in development.
- Unknown exceptions should become Nitro/H3 500 errors.

Redirects, rewrites, proxying, route auth, and route-level cache behavior should
stay in Nitro middleware or native `nitro.routeRules` for v0:

```ts
export default defineConfig({
  plugins: [resumable()],
  nitro: {
    routeRules: {
      "/old-docs/**": { redirect: "/docs/**" },
      "/api/**": { proxy: "https://api.example.com/**" }
    }
  }
});
```

Do not make `query$` a mini router. Queries can throw Nitro/H3 HTTP errors for
the resource they are reading, but request routing behavior belongs to Nitro.

## Relationship To Qwik

`query$` does not replace `useAsync$`.

`query$` defines the server read contract.

`useAsync$` creates async UI state inside a Qwik component.

`Suspense` displays fallback UI while async content is pending.

This preserves the Qwik v2 model instead of adding a competing query hook.

Avoid this:

```tsx
const post = useQuery(getPost, { slug });
```

Prefer this:

```tsx
const post = useAsync$(({ abortSignal }) => getPost({ slug }, { signal: abortSignal }));
```

## Relationship To Route Loaders

Resumable should not add route loaders as the primary data model.

Route loaders bind data to route files. Resumable's route files are already
reserved for default-exported Qwik page components, and layouts are explicit
components. Adding route loader exports would make route modules more magical
and harder for junior developers and AI agents to reason about.

Reusable query modules are easier to find, test, cache, validate, and reuse:

```txt
data/
  posts.ts
  users.ts
  search.ts
```

`data/` is a recommended organization convention, not a required framework
directory.

## Non-Goals

Data fetching v0 should not require:

- `useQuery`, `useMutation`, or equivalent Resumable hooks.
- `QueryClientProvider`.
- `HydrationBoundary`.
- `schema` for every query or action.
- Zod-specific schema wrappers.
- `query$(options, handler)` or `action$(options, handler)` as documented API
  shapes.
- A custom second-argument QRL transform for the v0 data API.
- A Resumable Vite pre-transform solely to support options-first data APIs.
- Route-local loader exports.
- Page-local data conventions.
- A public generated query registry imported by users.
- A global client cache users must create manually.
- Replacing Nitro API routes for public HTTP APIs.
- Resumable aliases for Nitro/H3 HTTP primitives such as generic HTTP errors,
  redirects, rewrites, proxies, or route rules.
- A global `getRequestEvent()` helper as the primary request context API.
- Tag-based invalidation as a v0 requirement.
- Durable cross-user caching by default.
- Mutations inside `query$`.

## Acceptance Criteria

SSR behavior:

- `query$(handler)` works for simple reads.
- `query$(handler, options)` works for configured reads.
- `schema` is optional.
- Calling the same query with the same validated input twice during one render
  executes the handler once.
- Duplicate callers receive the same in-flight promise and resolved value.
- Query output is serializable by Qwik.
- Query handler argument validation failure produces a direct error.
- Query handler return-value validation failure produces a direct error in
  development.
- Query handlers can access the native Nitro/H3 request event through
  `ctx.event`.
- Query handlers can access cancellation through `ctx.signal`.
- Thrown Nitro/H3 `HTTPError` values preserve their status and headers.
- A thrown Nitro/H3 `404` from a page query can render `pages/404.tsx` with a
  404 status for page requests.

SPA behavior:

- A resumed app can call an already-resolved query without refetching while it
  is fresh.
- `Link` navigation can reuse existing query records.
- Route payloads include only query records needed by the destination page.
- Fresh records already present in the browser query cache are not resent.
- Stale records may refetch according to query options.

Cache behavior:

- `cache: "5m"` and `cache: { private: "5m" }` keep browser query records fresh
  without using Nitro durable cache.
- `cache: { public: "5m" }` uses Nitro-backed durable cache and is documented
  as safe only for data that can be shared across users.
- `cache: { public: "5m", stale: "1h" }` maps to Nitro-backed
  stale-while-revalidate behavior while keeping `stale` as the public
  Resumable field name.
- Cache options cannot specify both `private` and `public`.
- Raw Nitro cache options are not accepted directly by `query$` in v0.

Action behavior:

- `action$(handler)` works for simple side effects.
- `action$(handler, options)` works for configured side effects.
- Actions validate the handler argument before executing.
- Actions validate the handler return value before returning.
- Actions can access the native Nitro/H3 request event through `ctx.event`.
- Actions can access cancellation through `ctx.signal`.
- Actions can call `ctx.refresh(queryFn, input?)`.
- Action refreshes are queued while the action runs and applied only after the
  action succeeds.
- Refreshed queries are treated as stale in the browser query cache, active
  records may refetch, and matching Nitro public cache entries are purged when
  applicable.

Progressive form behavior:

- Native `<form action={actionFn}>` accepts `action$` symbols.
- Native `<button formAction={actionFn}>` accepts `action$` symbols.
- `action$` symbols in `action` and `formAction` lower to concrete POST URLs in
  rendered HTML.
- Forms using `action$` symbols work without JavaScript.
- `method="get"` with an `action$` symbol is a direct dev/build error.
- No primary Resumable `<Form>` component is required.

Build-time behavior:

- Queries receive stable generated ids from file path and export name.
- Duplicate generated query ids fail the build with a direct error.
- The generated manifest maps query ids to server handlers.
- `query$` and `action$` work through Qwik's normal first-argument QRL
  optimizer convention.

## Confidence Gates

The data fetching design is coherent enough to prototype, but it should not be
treated as locked until these gates are proven.

### Type Inference Prototype

This should type correctly without explicit generics:

```ts
const PostBySlug = schema({
  input: z.object({
    slug: z.string()
  }),
  output: z.object({
    title: z.string()
  })
});

export const getPost = query$(
  async ({ slug }) => {
    // slug should infer as string.
    return db.posts.findBySlug(slug);
  },
  {
    schema: PostBySlug
  }
);
```

If the schema in the second argument cannot cleanly type the handler input and
output, the API shape needs to be revisited.

### SSR Dedupe Prototype

A fixture should prove:

```txt
same query + same input during one SSR render -> handler runs once
```

and:

```txt
Qwik serializes the resolved query state once
```

This is the core claim that Resumable can do better than route-local loaders and
generic client query hydration.

### SPA Query Delta Prototype

A fixture should prove:

```txt
browser already has post:hello
navigate to a page that needs post:hello
payload does not resend post:hello
```

Route payloads should include query deltas, not a full dehydrated client cache.

### Cache Semantics Table

The cache API is stable only if each mode can be explained directly:

| Mode                            | Request dedupe | Page-state serialization                                   | Browser query freshness                   | Nitro durable cache                                                  | Shared across users |
| ------------------------------- | -------------- | ---------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| omitted                         | yes            | yes, when the rendered UI needs it                         | stale immediately after resume/navigation | no                                                                   | no                  |
| `false`                         | yes            | only normal Qwik component state, no Resumable query reuse | never                                     | no                                                                   | no                  |
| `"5m"`                          | yes            | yes, when the rendered UI needs it                         | fresh for 5 minutes                       | no                                                                   | no                  |
| `{ private: "5m" }`             | yes            | yes, when the rendered UI needs it                         | fresh for 5 minutes                       | no                                                                   | no                  |
| `{ public: "5m" }`              | yes            | yes, when the rendered UI needs it                         | fresh for 5 minutes                       | yes, fresh for 5 minutes                                             | yes                 |
| `{ public: "5m", stale: "1h" }` | yes            | yes, when the rendered UI needs it                         | fresh for 5 minutes                       | yes, fresh for 5 minutes and stale for up to 1 hour while refreshing | yes                 |

`cache: "5m"` is intentionally only private/browser freshness. A query must use
`cache: { public: "5m" }` to opt into cross-user Nitro durable caching.

### Fixture Target

Create a focused fixture before calling the design complete:

```txt
fixtures/data-app/
  pages/
    index.tsx
    posts/
      [slug].tsx
  data/
    posts.ts
```

The fixture should cover schema inference, SSR dedupe, SPA reuse, action
refresh, and public cache behavior.

## Open Questions

- Should `schema`, `query$`, and `action$` be v0 or v0.x?
- Should duration values be strings only, or should numeric milliseconds also be
  accepted?
- What is the exact API for user-scoped and tenant-scoped durable caching?
- What is the exact enhanced form state API for pending status, validation
  errors, optimistic UI, and response handling?
- Should tag-based invalidation ever be added, or is query-symbol refresh enough
  for real applications?
- Should failed query records be serialized for SPA reuse or always refetched?
- Should production output validation be strict by default or configurable?
- Should Resumable ever add a `notFound()` helper, or is Nitro/H3 `HTTPError`
  enough for v0?
- Should redirects from `query$` or `action$` ever be supported directly, or
  should v0 keep redirects in Nitro middleware and route rules only?
- Should `schema` expose Standard JSON Schema metadata in v0, or only preserve
  enough metadata to add it later?
- Should `query$(handler)` and `action$(handler)` be the only shorthand forms,
  or should object-only forms be supported later for generated code?
- Should Qwik eventually support an explicit optional-config-first marker
  strategy for `$` APIs, enabling `query$(options, handler)` without
  Resumable-specific compiler behavior?
- Should Resumable expose an explicit query prefetch API, or should page payload
  prefetching through `Link` be enough for v0?

## References

- Qwik v2 `useAsync$` and `<Suspense>` docs in the upstream Qwik repository:
  `/Users/jacksm5pro/dev/open-source/qwik/packages/docs/src/routes/docs/(qwik)/core/state/index.mdx`
  and
  `/Users/jacksm5pro/dev/open-source/qwik/packages/docs/src/routes/docs/(qwik)/core/suspense/index.mdx`
- Solid Start `query` and `action` examples:
  https://github.com/solidjs/solid-start/blob/main/apps/fixtures/todomvc/src/lib/api.ts
- TanStack Start `createServerFn` examples:
  https://github.com/TanStack/router/blob/main/examples/react/start-trellaux/src/db/board.ts
- TanStack Router and Query integration examples:
  https://github.com/TanStack/router/blob/main/examples/react/basic-react-query/src/main.tsx
- TanStack SSR query integration:
  https://github.com/TanStack/router/blob/main/packages/router-ssr-query-core/src/index.ts
- Nitro cached function runtime:
  https://github.com/nitrojs/nitro/blob/main/src/runtime/internal/cache.ts
- H3 Standard Schema validation:
  https://github.com/h3js/h3/blob/main/src/utils/internal/validate.ts
- Standard Schema specification:
  https://github.com/standard-schema/standard-schema/blob/main/packages/spec/src/index.ts
- Standard JSON Schema:
  https://standardschema.dev/json-schema
