import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return <article>Dynamic blog slug: {props.params.slug}</article>;
});
