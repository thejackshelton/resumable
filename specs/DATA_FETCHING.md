# Resumable Data Fetching Specification

Status: Draft

Parent spec: [`SPEC.md`](./SPEC.md)

## Decision

Resumable does not own data fetching.

Data fetching, mutations, request context, validation, caching, storage,
headers, redirects, middleware, and deployment behavior belong to Nitro. Qwik
owns async UI state and resumability. Resumable only connects Qwik pages to the
Nitro-powered app shell.

Core rule:

```txt
Need page UI? Use pages/.
Need async UI state? Use Qwik primitives.
Need data or mutations? Use Nitro api/.
Need request context? Use Nitro middleware/.
Need cache, storage, route rules, runtime config, or deployment behavior? Use Nitro.
```

Resumable must not add a framework-owned data layer, server-function transport,
framework data cache, mutation refresh protocol, typed form action transport, or
Resumable-specific wrappers over Nitro handlers. Those features would create a
second server model next to Nitro and make the framework boundary harder to
teach.

## Ownership

Canonical ownership:

```txt
pages/       -> Resumable UI routes
components/  -> Qwik component tree
api/         -> Nitro API routes and data endpoints
middleware/  -> Nitro request pipeline and request context
public/      -> Nitro public assets
nitro: {}    -> native Nitro app config
```

Data-oriented application code should be authored as normal Nitro handlers,
Nitro middleware, Nitro plugins, Nitro route rules, and ordinary server modules
called by those handlers.

Resumable may generate framework internals needed to render pages through
Nitro, but those internals must not become a public data-fetching API.

## Example Style

Resumable examples should teach this boundary:

```txt
Data fetching is Nitro.
```

Examples should show native Nitro handler, middleware, validation, cache,
storage, and route-rule primitives by name, then link to Nitro docs for deeper
server behavior:

- Nitro docs: https://nitro.build/docs
- Nitro routing and API handlers: https://nitro.build/docs/routing
- Nitro cache: https://nitro.build/docs/cache
- Nitro storage: https://nitro.build/docs/storage

Resumable docs may include enough Nitro code to make examples runnable, but
they should not become a parallel Nitro manual. When an example needs auth,
request context, validation, caching, redirects, proxying, streaming, or
deployment behavior, the explanation should say that Nitro owns the feature and
send users to Nitro's documentation.

This rule is independent of whether a page is rendered as an MPA document, an
SPA navigation target, or a progressively enhanced interaction. Qwik async UI
primitives can consume Nitro data in component examples, but they are not the
data-fetching model. They are only one UI consumption pattern.

If a universal component needs different server and browser behavior, the
example may branch explicitly with Qwik environment flags such as `isServer` or
`isBrowser` after the exact pattern has fixture evidence. Do not hide that
branch behind a Resumable data helper.

## API Routes

Data endpoints live in top-level `api/` and use native Nitro handler APIs:

```ts
import { defineHandler } from "nitro";

export default defineHandler(async () => {
  return {
    posts: await db.posts.findMany()
  };
});
```

HTTP method suffixes, route params, body parsing, validation helpers, thrown
HTTP errors, response headers, streaming, storage, caching, and route rules
should follow Nitro/H3 behavior. Resumable docs should use Nitro names for
those concepts and link to Nitro docs instead of inventing aliases.

## Middleware

Request context belongs in Nitro middleware:

```ts
import { defineMiddleware } from "nitro";

export default defineMiddleware(async (event) => {
  event.context.user = await getUserFromSession(event);
});
```

API handlers read request context from the Nitro event. Pages should not receive
a Resumable-specific server context object for data fetching.

## UI Usage

Qwik components choose the UI state primitive. Resumable does not provide a data
hook.

For client-side or interaction-driven data, call Nitro endpoints with platform
fetching APIs from Qwik code:

```tsx
import { component$, useAsync$ } from "@qwik.dev/core";

export default component$(() => {
  const posts = useAsync$(async () => {
    const response = await fetch("/api/posts");

    if (!response.ok) {
      throw new Error("Failed to load posts.");
    }

    return response.json();
  });

  return <pre>{JSON.stringify(posts.value, null, 2)}</pre>;
});
```

For server-side rendering paths that need the same data as an endpoint, keep
the shared business logic in ordinary server modules and expose the public
boundary through Nitro. Resumable should not provide a hidden RPC path or a
special direct-call optimization.

## Forms And Mutations

Forms submit to real URLs:

```tsx
export default component$(() => {
  return (
    <form method="post" action="/api/contact">
      <input name="email" type="email" />
      <textarea name="message" />
      <button type="submit">Send</button>
    </form>
  );
});
```

The target endpoint is a Nitro API route. Pending state, optimistic UI, client
enhancement, and validation are application or Qwik concerns unless Nitro
provides the relevant server behavior. Resumable should not lower form actions
to framework-owned mutation symbols.

## Caching And Reuse

Caching is Nitro-owned.

Use Nitro route rules, Nitro storage, Nitro cached handlers, HTTP cache headers,
or app-specific cache modules. Resumable should not add framework data records,
browser data caches, data refresh APIs, or a separate durable cache
configuration surface.

SPA navigation may eventually prefetch page modules or page payloads, but it
must not depend on a Resumable-owned data cache. Any data fetched through Nitro
endpoints should follow normal HTTP, Nitro, and browser caching semantics.

## Validation

Validation is Nitro-owned or application-owned.

Applications may use Nitro/H3 validation utilities, Standard Schema-compatible
libraries, Zod, Valibot, ArkType, custom validation, or direct TypeScript types.
Resumable should not expose a package-level validation primitive for data
handlers.

## Non-Goals

Resumable data fetching should not include:

- A public server-function API.
- A public query or mutation primitive.
- A framework-owned data cache.
- A framework-owned mutation refresh or invalidation model.
- Resumable-specific handler, middleware, or validation wrappers.
- Type-safe API route URL generation.
- Typed form action symbols.
- A generated data manifest.
- A page-loader convention.
- A hidden RPC transport.
- A second request context abstraction over Nitro events.

## Acceptance

The data-fetching contract is satisfied when:

- The main framework spec states that Nitro permanently owns data fetching.
- The implementation plan has no milestone for a Resumable-owned data layer.
- Generated starters use Nitro `api/` and `middleware/` for server data
  examples.
- No public core API is specified for data fetching, mutation, validation,
  framework data caching, or mutation refresh.
- Existing Nitro passthrough evidence continues proving that top-level `api/`,
  `middleware/`, `public/`, and `nitro: {}` preserve Nitro semantics around
  page rendering.
