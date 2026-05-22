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
        alt="Resumable turns pages, API routes, middleware, and Vite config into a Qwik and Nitro app"
        src="docs/readme-animation.gif"
        width="720"
      >
    </picture>

-->

  <p><strong>A minimal Qwik meta-framework for Vite, powered by Nitro.</strong></p>

  <p>
    Pages are Resumable. Components are Qwik. Server behavior is Nitro.
    Configuration is Vite. Tooling is Vite+.
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
api/         -> Nitro API routes
middleware/  -> Nitro request pipeline
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

Layouts are normal Qwik components. `app.tsx` is optional and customizes the
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
