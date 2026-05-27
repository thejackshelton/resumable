# Repository Instructions

## Resumable Workflow

When working in this repo, always apply the repo-local skills in `.codex/skills`:

- Use `resumable-research` before answering design, API, DX, or architecture questions, and before deciding direction on Qwik, qwik-bundler, Nitro, Vite, SSR, SPA navigation, routing, middleware, endpoints, query/action data loading, manifest injection, or bundle graph behavior.
- Use `resumable-implementation` before editing code or fixtures.

If those skills are not available in the session skill list, read their `SKILL.md` files directly and follow them anyway.

## Implementation Standard

- Check `git status --short` and inspect relevant diffs before editing.
- Preserve user changes. Do not revert unrelated dirty work.
- Make the smallest surgical edit that solves the current problem.
- For browser-visible behavior, QA the local fixture with the Vercel agent browser before final response. Prefer real click/navigation checks over markup-only or unit-test-only verification.
- Prefer `ufo` for URL/base joining and `pathe` for filesystem path handling.
- Use Vite 8+ environment APIs directly when wiring Vite environments.
- Avoid unnecessary virtual modules, wrappers, no-op placeholders, future hooks, and custom path parsing.
- Do not rewrite rendered asset URLs with regex.
- Do not add route outlet wrapper DOM just to simplify swaps.
- Do not render framework scripts as direct children of `<html>`.
- Do not create a custom History API router while the Navigation API or `@virtualstate/navigation` can provide the platform-shaped runtime.

Before testing or final response, assume the first implementation is over-engineered. Re-read the diff and simplify anything that is not required while preserving the behavior.
