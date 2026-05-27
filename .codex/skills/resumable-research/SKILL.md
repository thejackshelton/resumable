---
name: resumable-research
description: Use when researching Resumable, Qwik, qwik-bundler, Nitro, Vite, SSR, SPA navigation, route outlets, Qwik manifest or bundle graph behavior, data loading API design, middleware/endpoint DX, or public framework patterns before deciding what to implement. This is the necessary research skill: inspect local source and use grep MCP for real-world patterns before making claims.
---

# Resumable Research

## Source Map

- Resumable repo: `/Users/jacksm5pro/dev/open-source/resumable`
- qwik-bundler repo: `/Users/jacksm5pro/dev/open-source/qwik-bundler`
- upstream Qwik repo: `/Users/jacksm5pro/dev/open-source/qwik`

## Workflow

1. Start with `git status --short` in Resumable and inspect relevant diffs so research does not trample user work.
2. Use `rg` or `rg --files` first. Search local source before relying on memory.
3. Use grep MCP when comparing public API, DX, Vite plugin patterns, framework router behavior, middleware/endpoint naming, manifest injection, isomorphic implementations, or "how do others solve this?" questions. Search for literal code patterns.
4. Inspect `qwik-bundler` for bundle graph, manifest injection, Vite plugin APIs, optimizer behavior, entry creation, preload/modulepreload behavior, and anything involving `registerBundleGraphAdder`.
5. Inspect upstream Qwik for `renderToString`, container attributes, `q:base`, Qwik manifest injections, Qwik loader placement, `RouterOutlet`, `useOnDocument`, event serialization, `qDestroy`, and resume/runtime behavior.
6. Separate direct source facts from inference. Cite local file/line references where useful.

## Research Guardrails

- Do not call Qwik resume behavior "hydration" unless quoting source. Use "resume", "serialize", "snapshot", or "payload".
- Keep Nitro as an implementation detail in user-facing API discussion unless the user explicitly asks about Nitro.
- For SPA navigation research, check how Qwik preserves the container and route outlet before proposing DOM replacement.
- If the answer turns into code changes, also use the Resumable implementation skill.
