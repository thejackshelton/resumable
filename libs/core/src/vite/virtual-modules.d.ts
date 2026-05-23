declare module "virtual:resumable/routes" {
  export const pageModuleLoaders: Record<string, () => Promise<unknown>>;
  export const routeFileIds: string[];
}

declare module "virtual:resumable/client-entry" {
  export const appModules: Record<string, () => Promise<unknown>>;
  export const pageModules: Record<string, () => Promise<unknown>>;
}

declare module "virtual:resumable/server-entry" {
  const entry: {
    fetch(request: Request): Promise<Response>;
  };

  export const fetch: typeof entry.fetch;
  export default entry;
}
