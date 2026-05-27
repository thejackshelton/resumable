import { component$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const count = useSignal(0);

  return (
    <main>
      <h1>Minimal Resumable Fixture</h1>
      <button onClick$={() => count.value++}>Home count: {count.value}</button>
      <a href="/about">About</a>
      <a href="/blog/[slug]" params={{ slug: "fixture-post" }}>
        Typed blog route
      </a>
      <a href="/links">Link fixture</a>
    </main>
  );
});
