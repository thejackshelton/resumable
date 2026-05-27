import { component$, Slot } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$(() => {
  return (
    <Html lang="en">
      <head>
        <title>Resumable</title>
      </head>
      <body>
        <Slot />
      </body>
    </Html>
  );
});
