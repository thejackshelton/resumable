import { defineHandler, HTTPError } from "nitro";
import type { EventHandler } from "nitro/h3";

const handler: EventHandler = defineHandler(() => {
  throw HTTPError.status(503, "API unavailable");
});

export default handler;
