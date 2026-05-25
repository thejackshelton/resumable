import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
  event.context.requestId = "data-fetching-middleware";
  event.res.headers.set("x-data-fetching-middleware", "ran");
});
