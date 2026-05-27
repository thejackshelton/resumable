import { component$ } from "@qwik.dev/core";

export const Sidebar = component$((props: { active: string }) => {
  return (
    <aside>
      <nav aria-label="Docs">
        <a aria-current={props.active === "overview" ? "page" : undefined} href="/docs">
          Overview
        </a>
        <a
          aria-current={props.active === "getting-started" ? "page" : undefined}
          href="/docs/getting-started"
        >
          Getting Started
        </a>
      </nav>
    </aside>
  );
});
