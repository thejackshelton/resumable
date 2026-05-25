import { defineHandler, HTTPError, serverFetch } from "nitro";
import { getRouterParam, withServerTiming } from "nitro/h3";
import { findPost, type Post } from "../../data/posts";

interface PostsResponse {
  readonly posts: readonly Post[];
}

export default defineHandler(async (event) => {
  const slug = getRouterParam(event, "slug", { decode: true });

  if (!slug) {
    throw HTTPError.status(400, "Bad Request", {
      message: "Missing post slug"
    });
  }

  const post = await withServerTiming(event, "post", () => findPost(slug));

  if (!post) {
    throw HTTPError.status(404, "Not Found", {
      data: { slug },
      message: "Post not found"
    });
  }

  const relatedResponse = await serverFetch(
    `/api/posts?tag=${encodeURIComponent(post.tags[0])}`,
    undefined,
    event.context
  );
  const relatedPosts = relatedResponse.ok
    ? ((await relatedResponse.json()) as PostsResponse).posts
    : [];

  return {
    post,
    related: relatedPosts
      .filter((relatedPost) => relatedPost.slug !== post.slug)
      .map((relatedPost) => relatedPost.slug),
    requestId: event.context.requestId ?? null
  };
});
