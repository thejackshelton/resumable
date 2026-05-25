import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return (
    <main>
      <h1>Minimal Resumable Fixture</h1>
      <a href="/about">About</a>
      <a href="/blog/[slug]" params={{ slug: "fixture-post" }}>
        Typed blog route
      </a>
    </main>
  );
});
