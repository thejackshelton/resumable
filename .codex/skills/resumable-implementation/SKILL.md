---
name: resumable-implementation
description: Use when implementing changes in the Resumable repo, especially Qwik/qwik-bundler/Vite/Nitro integration, SSR rendering, SPA navigation, route outlets, typed routes, data loading, middleware/endpoints, path handling, or fixture updates. Enforces minimal surgical edits, simpler package helpers like ufo and pathe, Vite 8+ environment APIs, verification, and a deliberate simplification pass because implementations tend to be over-engineered.
---

# Resumable Implementation

## Before Editing

1. Run `git status --short` and inspect relevant diffs. Preserve user changes.
2. If the right design is unclear, use the Resumable research skill first.
3. Prefer the repo's existing patterns over new abstractions.
4. Use `apply_patch` for manual file edits.

## Implementation Rules

- Make the smallest surgical edit that solves the current problem.
- Treat the first implementation as over-engineered. Before testing and final response, re-read the diff and delete anything that is not required.
- Prefer `ufo` for URL/base joining and `pathe` for filesystem path handling. Keep custom path parsing minimal.
- Use Vite 8+ environment APIs directly when wiring environments: `configEnvironment`, `EnvironmentOptions.consumer`, and `build.rolldownOptions.input` where that is the local pattern.
- Do not add virtual modules, environment probes, wrappers, no-op placeholders, or future-facing hooks when existing Vite/Qwik/qwik-bundler state already carries the data.
- Do not rewrite rendered asset URLs with regex. Respect Vite config and Qwik render options.
- Do not render framework scripts as direct children of `<html>`. They must end up under valid `<head>` or `<body>` locations.
- Do not add route outlet wrapper DOM just to simplify swaps.
- Do not create a custom History API router while the Navigation API or `@virtualstate/navigation` can provide the platform-shaped runtime.
- Keep public DX names and docs Qwik-native; Nitro should remain an implementation detail unless the task is specifically about Nitro.

## Simplification Pass

Before calling the work done, ask:

- Can any helper be inlined without making the code harder to read?
- Did this add a new option, virtual module, branch, or dependency that can be removed?
- Is there duplicated path/URL logic that should use `ufo` or `pathe`?
- Is a test asserting an implementation detail that would make better code harder?
- Did I solve only this slice, or did I build future infrastructure?

## Verification

- For narrow source changes, run focused `vp test` files first.
- For core integration changes, run `pnpm --filter @resumable.dev/core build`.
- For route/SSR/SPA changes, run the focused Vite/server-entry/minimal fixture tests.
- If dev server behavior matters, run the fixture dev server and inspect the page. If sandboxing blocks it, request escalation instead of guessing.
