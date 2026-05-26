export interface Post {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly tags: readonly string[];
}

const posts: readonly Post[] = [
  {
    slug: "qwik-resumability",
    title: "Qwik resumability",
    excerpt: "Async UI state can consume ordinary HTTP endpoints.",
    tags: ["qwik", "http"]
  },
  {
    slug: "http-boundary",
    title: "HTTP owns requests",
    excerpt: "Routes, middleware, storage, caching, and headers stay HTTP-native.",
    tags: ["qwik", "http"]
  },
  {
    slug: "storage-cache",
    title: "Storage and cache",
    excerpt: "Storage and cached endpoints are reusable from API routes.",
    tags: ["http", "cache"]
  }
];

interface ListPostsOptions {
  readonly tag?: string;
  readonly limit?: number;
}

export async function listPosts(options: ListPostsOptions = {}) {
  const tag = options.tag;
  const filteredPosts = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;

  return typeof options.limit === "number"
    ? filteredPosts.slice(0, options.limit)
    : filteredPosts;
}

export async function findPost(slug: string) {
  return posts.find((post) => post.slug === slug) ?? null;
}
