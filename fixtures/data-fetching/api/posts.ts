import { useRuntimeConfig } from "nitro/runtime-config";
import { listPosts } from "../data/posts";

interface DataFetchingRuntimeConfig {
  readonly dataFetching?: {
    readonly defaultLimit?: number;
  };
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const cache = {
  maxAge: 60
};

export default async function (http) {
  const query = Object.fromEntries(http.url.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const runtimeConfig = useRuntimeConfig() as DataFetchingRuntimeConfig;
  const queryLimit = Number.parseInt(first(query.limit) ?? "", 10);
  const limit = Number.isFinite(queryLimit)
    ? queryLimit
    : runtimeConfig.dataFetching?.defaultLimit;
  const tag = first(query.tag);

  http.response.headers.set("server-timing", "posts");
  http.response.headers.set("x-data-fetching-source", "cached-handler");

  const posts = await listPosts({ tag, limit });

  return {
    count: posts.length,
    filter: {
      limit: limit ?? null,
      tag: tag ?? null
    },
    posts,
    requestId: http.locals.requestId ?? null
  };
}
