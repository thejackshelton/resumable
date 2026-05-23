import { defineHandler } from "nitro";
import type { EventHandler } from "nitro/h3";

const handler: EventHandler = defineHandler(() => {
  return { ok: true, route: "api/health" };
});

export default handler;
