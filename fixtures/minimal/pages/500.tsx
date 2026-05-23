import { component$ } from "@qwik.dev/core";
import type { PageProps } from "@resumable.dev/core";

export default component$((props: PageProps) => {
  return (
    <div>
      <h1>500</h1>
      <p>Status: {props.status}</p>
      <p>Pathname: {props.url.pathname}</p>
      <p>Search: {props.url.search}</p>
      <p>Href: {props.url.href}</p>
      <p>Params: {Object.keys(props.params).length}</p>
    </div>
  );
});
