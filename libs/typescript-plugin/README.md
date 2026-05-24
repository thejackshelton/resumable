# Resumable TypeScript Plugin

Status: experimental

Enable it from `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@resumable.dev/typescript-plugin",
        "pagesDir": "./pages"
      }
    ]
  }
}
```

The plugin runs inside TypeScript 6 `tsserver`, so editors that already use the
workspace TypeScript server can pick up Resumable page intelligence from project
configuration instead of a Resumable editor extension.

Published installs should be discovered from `tsconfig.json`. Editor settings are
only fallback/debugging tools for wrappers that are not using the workspace
TypeScript server, or for local unpublished workspace-link testing.

The current proof verifies:

- default-exported components in the configured top-level `pages` folder receive
  real `PageProps` typing through the TypeScript language service;
- `props.url.href`, `props.url.pathname`, `props.url.search`, and `props.status`
  use native TypeScript hovers/completions instead of plugin-painted `any`;
- top-level `document.tsx` receives document-wide props, including optional
  params collected from every page route;
- non-default page components keep native TypeScript `unknown` diagnostics;
- files outside the configured top-level `pages` folder, including `src/pages`,
  do not receive page prop typing;
- native TypeScript completions still come through the normal language service;
- edits back to `export default` recover without a language-server restart.

Run:

```sh
pnpm --filter @resumable.dev/typescript-plugin proof
```
