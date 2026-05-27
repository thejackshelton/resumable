export default function (http) {
  http.response.headers.set("x-resumable-started-at", String(Date.now()));
}
