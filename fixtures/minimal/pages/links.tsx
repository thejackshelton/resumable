import { component$, useSignal } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const blogSlug = "fixture-link-post";
  const count = useSignal(0);

  return (
    <main style={{ minHeight: "180vh", paddingBottom: "60vh" }}>
      <h1>Link fixture</h1>
      <button onClick$={() => count.value++}>Links count: {count.value}</button>
      <Link class="link-static" href="/about">
        Static Link
      </Link>
      <Link
        class="link-dynamic"
        data-kind="dynamic-link"
        href="/blog/[slug]"
        params={{ slug: blogSlug }}
        prefetch="intent"
      >
        Dynamic Link
      </Link>
      <Link
        class="link-catch-all"
        href="/docs/[...slug]"
        params={{ slug: ["guides", "fixture"] }}
      >
        Catch-all Link
      </Link>
    </main>
  );
});
