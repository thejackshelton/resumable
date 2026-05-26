import "@resumable.dev/core";

declare module "@resumable.dev/core" {
  interface AppLocals {
    requestId?: string;
  }
}
