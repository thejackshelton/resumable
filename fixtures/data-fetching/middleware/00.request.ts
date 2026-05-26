export default function (http) {
  http.locals.requestId = "data-fetching-middleware";
  http.response.headers.set("x-data-fetching-middleware", "ran");
}
