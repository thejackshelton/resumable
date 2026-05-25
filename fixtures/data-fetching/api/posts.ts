import { defineCachedHandler } from "nitro/cache";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getQuery, setServerTiming } from "nitro/h3";
import { listPosts } from "../data/posts";

interface DataFetchingRuntimeConfig {
  readonly dataFetching?: {
    readonly defaultLimit?: number;
  };
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default defineCachedHandler(
  async (event) => {
    const query = getQuery(event) as Record<string, string | string[] | undefined>;
    const runtimeConfig = useRuntimeConfig() as DataFetchingRuntimeConfig;
    const queryLimit = Number.parseInt(first(query.limit) ?? "", 10);
    const limit = Number.isFinite(queryLimit)
      ? queryLimit
      : runtimeConfig.dataFetching?.defaultLimit;
    const tag = first(query.tag);

    setServerTiming(event, "posts");
    event.res.headers.set("x-data-fetching-source", "cached-handler");

    const posts = await listPosts({ tag, limit });

    return {
      count: posts.length,
      filter: {
        limit: limit ?? null,
        tag: tag ?? null
      },
      posts,
      requestId: event.context.requestId ?? null
    };
  },
  {
    maxAge: 60,
    name: "data-fetching-posts"
  }
);
