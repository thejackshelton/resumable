import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return (
    <div>
      <h1>404</h1>
      <p>Status: {props.status}</p>
      <p>Pathname: {props.url.pathname}</p>
      <p>Params: {Object.keys(props.params).length}</p>
    </div>
  );
});
