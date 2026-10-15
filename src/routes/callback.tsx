import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { finishPollinationsConnect } from "@/lib/pollinations";

export const Route = createFileRoute("/callback")({
  head: () => ({
    meta: [
      { title: "Connecting Pollinations — NO QUIT AI" },
      { name: "description", content: "Finishing your free Pollinations connection for NO QUIT AI image generation." },
      { property: "og:title", content: "Connecting Pollinations — NO QUIT AI" },
      { property: "og:description", content: "Finishing your free Pollinations connection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const [msg, setMsg] = useState("Pollinations se connect ho raha hai...");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code");
    const state = p.get("state") ?? "";
    if (!code) {
      setMsg(`Connect nahi hua: ${p.get("error") ?? "code missing"}`);
      return;
    }
    finishPollinationsConnect(code, state)
      .then((back) => {
        setMsg("Connected! Wapas ja rahe hain...");
        window.location.replace(back);
      })
      .catch((e: unknown) => setMsg(`Connect nahi hua: ${e instanceof Error ? e.message : "error"}`));
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="space-y-4">
        <p>{msg}</p>
        <a href="/" className="text-sm text-primary underline">Home</a>
      </div>
    </main>
  );
}
