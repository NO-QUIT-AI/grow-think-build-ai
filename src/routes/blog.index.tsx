import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalFooter } from "@/components/legal/LegalPage";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Guides for AI Building, CVs and Prompts | NO QUIT AI" },
      {
        name: "description",
        content:
          "Practical guides from NO QUIT AI: build websites with AI chat, make a professional CV and write better prompts.",
      },
      { property: "og:title", content: "NO QUIT AI Blog" },
      {
        property: "og:description",
        content: "Step-by-step guides on AI website building, CV writing and prompt tips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
        ← NO QUIT AI
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">NO QUIT AI Blog</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Practical guides to help you build, write and grow with AI.
      </p>
      <div className="mt-6 space-y-4">
        {BLOG_POSTS.map((p) => (
          <Link
            key={p.slug}
            to="/blog/$slug"
            params={{ slug: p.slug }}
            className="block rounded-lg border border-border p-4 transition hover:border-primary"
          >
            <h2 className="text-base font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {p.date} · {p.readMinutes} min read
            </p>
          </Link>
        ))}
      </div>
      <LegalFooter />
    </main>
  );
}
