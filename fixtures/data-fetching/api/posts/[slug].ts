import { findPost, listPosts } from "../../data/posts";

export default async function (http) {
  const slug = http.params.slug;
  if (!slug) {
    http.response.status = 400;
    return {
      message: "Missing post slug"
    };
  }

  http.response.headers.set("server-timing", "post");
  const post = await findPost(slug);

  if (!post) {
    http.response.status = 404;
    return {
      data: { slug },
      message: "Post not found"
    };
  }

  const relatedPosts = await listPosts({ tag: post.tags[0] });

  return {
    post,
    related: relatedPosts
      .filter((relatedPost) => relatedPost.slug !== post.slug)
      .map((relatedPost) => relatedPost.slug),
    requestId: http.locals.requestId ?? null
  };
}
