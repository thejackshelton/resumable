import "@resumable.dev/core";

declare module "@resumable.dev/core" {
  interface AppContext {
    requestId?: string;
  }
}
