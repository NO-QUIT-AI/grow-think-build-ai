import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { LegalFooter } from "@/components/legal/LegalPage";
import { getPost } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Post not found — NO QUIT AI" }] };
    return {
      meta: [
        { title: `${p.title} | NO QUIT AI` },
        { name: "description", content: p.description },
        { property: "og:title", content: p.title },
        { property: "og:description", content: p.description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm">
      Post not found. <Link to="/blog" className="underline">Back to blog</Link>
    </main>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link to="/blog" className="text-xs text-muted-foreground hover:text-primary">
        ← All articles
      </Link>
      <article>
        <h1 className="mt-3 text-2xl font-semibold leading-tight">{post.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {post.date} · {post.readMinutes} min read · NO QUIT AI Team
        </p>
        <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
          {post.sections.map((s) => (
            <section key={s.h} className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">{s.h}</h2>
              {s.p.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
      <LegalFooter />
    </main>
  );
}
