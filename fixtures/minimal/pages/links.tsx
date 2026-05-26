import { component$ } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const blogSlug = "fixture-link-post";

  return (
    <main>
      <h1>Link fixture</h1>
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
        reload
      >
        Catch-all Link
      </Link>
    </main>
  );
});
