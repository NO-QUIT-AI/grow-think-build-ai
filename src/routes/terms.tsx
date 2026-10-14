import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — NO QUIT AI" },
      {
        name: "description",
        content:
          "The rules for using NO QUIT AI: accounts, acceptable use, AI generated content, NQAI reward points and advertising.",
      },
      { property: "og:title", content: "Terms of Service — NO QUIT AI" },
      {
        property: "og:description",
        content: "Accounts, acceptable use, content ownership and NQAI rewards on NO QUIT AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="19 September 2026">
      <p>By creating an account or using NO QUIT AI you agree to these terms.</p>

      <h2>Your account</h2>
      <p>
        You must provide accurate information, keep your login secure and be at least 13 years old.
        You are responsible for everything done through your account.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No illegal, hateful, harassing, sexual or violent content.</li>
        <li>No spam, scams, malware or attempts to break into the service.</li>
        <li>No automated scraping, bots or scripts against the AI or the reward system.</li>
        <li>No impersonation of other people or businesses.</li>
      </ul>

      <h2>AI generated content</h2>
      <p>
        You own the prompts you write and the projects you generate, and you are responsible for how
        you use them. AI output can be inaccurate or incomplete — always review it before relying on
        it. We provide the service "as is" without warranties.
      </p>

      <h2>NQAI reward points</h2>
      <p>
        NQAI points are an in-app reward for activity such as daily mining, sharing your invite link,
        posting and inviting friends. They have no monetary value, are not a cryptocurrency or
        investment, cannot be exchanged for cash, and may be adjusted or removed if earned through
        fraud, fake accounts, automated clicks or other abuse.
      </p>

      <h2>Advertising</h2>
      <p>
        The service is supported by advertising. You must never click ads artificially or encourage
        others to do so; accounts doing this will be suspended.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or end accounts that break these
        terms or put the service or other users at risk.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms; continued use means you accept the update. Questions:{" "}
        <a className="underline" href="mailto:ranaimranp2@gmail.com">ranaimranp2@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
