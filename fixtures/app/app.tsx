import { component$, Slot, useComputed$ } from "@qwik.dev/core";
import { Html } from "@resumable.dev/core";

export default component$((props) => {
  const section = useComputed$(
    () => props.url.pathname.split("/")[1] || "home",
  );

  return (
    <Html
      lang="en"
      data-path={props.url.pathname}
      data-status={String(props.status)}
    >
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body data-status={String(props.status)} data-path={props.url.pathname}>
        <header>Shell {section.value}</header>
        <Slot />
      </body>
    </Html>
  );
});
