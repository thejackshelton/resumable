import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  return <article>Docs catch-all slug: {props.params.slug}</article>;
});
