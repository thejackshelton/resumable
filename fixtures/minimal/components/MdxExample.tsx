import { component$, Slot, useSignal } from "@qwik.dev/core";

export const MdxCallout = component$((props: { tone: "plain" | "composed" }) => {
  return <aside data-tone={props.tone}>MDX imported a Qwik component.</aside>;
});

export const MdxCounter = component$((props: { label: string }) => {
  const count = useSignal(0);

  return (
    <button data-mdx-counter={props.label} onClick$={() => count.value++}>
      {props.label} count: {count.value}
    </button>
  );
});

export const ComposedMdxFrame = component$((props: { section: string }) => {
  return (
    <article data-section={props.section}>
      <header>Composed MDX frame before content</header>
      <Slot />
      <footer>Composed MDX frame after content</footer>
    </article>
  );
});
