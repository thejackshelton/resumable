import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return <article>Docs catch-all slug: {props.params.slug}</article>;
});
