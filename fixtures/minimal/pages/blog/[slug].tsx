import { component$, useSignal } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$((props) => {
  const count = useSignal(0);

  return (
    <article>
      <h1>Dynamic blog slug: {props.params.slug}</h1>
      <button onClick$={() => count.value++}>Blog count: {count.value}</button>
      <Link href="/links">Link fixture</Link>
    </article>
  );
});
