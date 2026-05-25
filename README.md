# Resumable

<div align="center">
  <!--
    Future README animation:
    Export the Lottie animation to GIF or WebP, place it at
    docs/readme-animation.webp, then uncomment this picture block. GitHub
    README Markdown renders images, but does not run a Lottie player.

    <picture>
      <source srcset="docs/readme-animation.webp" type="image/webp">
      <img
        alt="Resumable keeps apps readable for humans and agents"
        src="docs/readme-animation.gif"
        width="720"
      >
    </picture>

-->

  <p><strong>Apps humans and agents can read.</strong></p>

  <p>
    Resumable keeps the app model plain: pages are files, layouts are
    components, data can resume, and work runs only when your users care.
  </p>
</div>

> Status: pre-release. The specs are draft but authoritative, and the
> implementation is still an early scaffold.

## Planned Start

```sh
pnpm create resumable my-app
cd my-app
pnpm dev
```

Generated apps are designed to use Vite+ locally:

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

## App Model

```txt
pages/       -> Resumable UI routes
components/  -> Qwik component tree
api/         -> HTTP method exports lowered to Nitro
middleware/  -> request functions lowered to Nitro
public/      -> Nitro public assets
vite.config  -> Vite, Qwik, Resumable, and Nitro config
```

Routes are file-based:

```txt
pages/index.tsx          -> /
pages/about.tsx          -> /about
pages/blog/[slug].tsx    -> /blog/:slug
pages/docs/[...slug].tsx -> /docs/**
```

Layouts are normal Qwik components. `document.tsx` is optional and customizes the
global document shell. Root `pages/404.tsx` and `pages/500.tsx` provide status
pages.

## Vite Config

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    // Native Nitro config.
  }
});
```

Resumable owns the Qwik page routing and Nitro wiring. Nitro remains the server
runtime for API routes, middleware, route rules, runtime config, storage,
caching, and deployment presets.

## Specs

Start with [`specs/README.md`](./specs/README.md). The current product direction
is split across:

- [`specs/SPEC.md`](./specs/SPEC.md)
- [`specs/CLI_SPEC.md`](./specs/CLI_SPEC.md)
- [`specs/TYPED_ROUTING.md`](./specs/TYPED_ROUTING.md)
- [`specs/DATA_FETCHING.md`](./specs/DATA_FETCHING.md)
- [`specs/IMPLEMENTATION_PLAN.md`](./specs/IMPLEMENTATION_PLAN.md)
- [`specs/state.md`](./specs/state.md)

## Repository Commands

```sh
pnpm install
pnpm check.format
pnpm build
```

Use Node `>=24.9.0` and pnpm `9.14.4`.
