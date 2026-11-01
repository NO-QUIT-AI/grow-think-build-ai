import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, ShieldCheck, Mail } from "lucide-react";

import { LegalPage } from "@/components/legal/LegalPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/account-deletion")({
  head: () => ({
    meta: [
      { title: "Delete Your Account — NO QUIT AI" },
      {
        name: "description",
        content:
          "Request deletion of your NO QUIT AI account and all associated data — websites, chats, CVs and profile — from the web or the Android app.",
      },
      { property: "og:title", content: "Delete Your Account — NO QUIT AI" },
      {
        property: "og:description",
        content: "How to permanently delete your NO QUIT AI account and data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountDeletion,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AccountDeletion() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setState("error");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/public/account-deletion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: clean, note: note.trim() || undefined }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <LegalPage title="Delete Your Account" updated="1 November 2026">
      <p>
        You can permanently delete your NO QUIT AI account and all data linked to it — your
        profile, saved websites and builds, CVs, chat history, community posts and messages.
        Deletion is irreversible.
      </p>

      <h2>Option 1 — Request deletion online (fastest)</h2>
      {state === "done" ? (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-foreground">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Request received
          </p>
          <p className="mt-1">
            Shukriya. Your deletion request for <strong>{email.trim().toLowerCase()}</strong> has
            been recorded. We will delete the account and its data within 30 days and confirm by
            email. If you change your mind before then, just reply to that email.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
          <label className="block text-xs font-medium text-foreground" htmlFor="del-email">
            Email address of the account you want to delete
          </label>
          <Input
            id="del-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
          />
          <label className="block text-xs font-medium text-foreground" htmlFor="del-note">
            Reason (optional)
          </label>
          <Input
            id="del-note"
            type="text"
            placeholder="Why are you leaving? (optional)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          {state === "error" && (
            <p className="text-xs text-destructive">
              Please enter a valid email address, or try again in a moment.
            </p>
          )}
          <Button onClick={submit} disabled={state === "sending"} className="gap-2">
            <Trash2 className="h-4 w-4" />
            {state === "sending" ? "Sending…" : "Request Account Deletion"}
          </Button>
        </div>
      )}

      <h2>Option 2 — From inside the Android app</h2>
      <ol className="ml-4 list-decimal space-y-1">
        <li>Open the NO QUIT AI app and sign in.</li>
        <li>Open this page from the app menu (Account Deletion), or visit noquitai.com/account-deletion in any browser.</li>
        <li>Enter the same email you signed in with and tap "Request Account Deletion".</li>
      </ol>

      <h2>Option 3 — By email</h2>
      <p>
        Email us at{" "}
        <a className="underline" href="mailto:ranaimranp2@gmail.com">
          ranaimranp2@gmail.com
        </a>{" "}
        with the subject "Delete my account" from the email address linked to your account.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile (name, username, avatar, bio).</li>
        <li>All saved websites, builds, CVs and uploaded files.</li>
        <li>Chat history, direct messages and community posts/comments.</li>
        <li>Reward points, invites and activity history.</li>
      </ul>
      <p>
        Some security and abuse-prevention logs may be kept for up to 90 days as required for
        fraud prevention, then deleted.
      </p>

      <h2>How long it takes</h2>
      <p>
        Requests are processed within 30 days. You will receive a confirmation email once the
        deletion is complete.
      </p>

      <p className="flex items-center gap-2 text-xs">
        <Mail className="h-3.5 w-3.5" /> Questions? Contact{" "}
        <a className="underline" href="mailto:ranaimranp2@gmail.com">
          ranaimranp2@gmail.com
        </a>
      </p>
    </LegalPage>
  );
}
