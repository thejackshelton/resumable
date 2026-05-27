import { component$, Slot } from "@qwik.dev/core";

export const DocsLayout = component$((props: { section: string }) => {
  return (
    <section data-docs-section={props.section}>
      <Slot />
    </section>
  );
});
