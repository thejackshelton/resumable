import { HTTPError } from "nitro";

export default function () {
  throw HTTPError.status(503, "API unavailable");
}
