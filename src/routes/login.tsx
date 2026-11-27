import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — NO QUIT AI" },
      { name: "description", content: "Continue to the NO QUIT AI sign-in page." },
      { property: "og:title", content: "Sign in — NO QUIT AI" },
      { property: "og:description", content: "Continue to the NO QUIT AI sign-in page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth", statusCode: 301, replace: true });
  },
});
