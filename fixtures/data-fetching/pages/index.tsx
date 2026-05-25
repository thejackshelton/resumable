import { component$, useAsync$ } from "@qwik.dev/core";
import { listPosts, type Post } from "../data/posts";

interface PostsPayload {
  readonly posts: readonly Post[];
  readonly source: string;
}

async function loadFeaturedPosts() {
  return {
    posts: await listPosts({ tag: "qwik", limit: 2 }),
    source: "colocated-page-loader"
  } satisfies PostsPayload;
}

export default component$(() => {
  const featuredPosts = useAsync$(loadFeaturedPosts);

  return (
    <main>
      <h1>Data Fetching Fixture</h1>
      <section>
        <h2>Colocated page data</h2>
        <p>{featuredPosts.value.source}</p>
        <ul>
          {featuredPosts.value.posts.map((post) => (
            <li key={post.slug}>{post.title}</li>
          ))}
        </ul>
      </section>
      <ul>
        <li>/api/posts</li>
        <li>/api/posts/qwik-resumability</li>
      </ul>
      <form method="post" action="/api/contact">
        <label>
          Email
          <input name="email" type="email" value="hello@example.com" />
        </label>
        <label>
          Message
          <textarea name="message" rows={3}>
            Hello from a Nitro form route.
          </textarea>
        </label>
        <button type="submit">Send</button>
      </form>
    </main>
  );
});
