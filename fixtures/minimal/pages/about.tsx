import { component$, useSignal } from "@qwik.dev/core";
import { Link } from "@resumable.dev/core";

export default component$(() => {
  const count = useSignal(0);

  return (
    <main>
      <h1>About page</h1>
      <button onClick$={() => count.value++}>About count: {count.value}</button>
      <Link href="/links">Link fixture</Link>
    </main>
  );
});
