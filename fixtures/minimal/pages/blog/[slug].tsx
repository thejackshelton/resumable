import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  return <article>Dynamic blog slug: {props.params.slug}</article>;
});
