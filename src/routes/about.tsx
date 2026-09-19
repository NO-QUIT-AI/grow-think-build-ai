import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Contact — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI is a self-growing AI workspace that builds websites and apps from a simple chat, with a builder community and NQAI rewards. Contact the team here.",
      },
      { property: "og:title", content: "About & Contact — NO QUIT AI" },
      {
        property: "og:description",
        content: "Who we are, what NO QUIT AI does and how to reach the team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <LegalPage title="About & Contact" updated="19 September 2026">
      <h2>What NO QUIT AI is</h2>
      <p>
        NO QUIT AI is a self-growing AI workspace. You describe an idea in plain language — in
        English or Roman Urdu — and the assistant thinks it through, builds a website or app, shows a
        live preview in the Studio, and keeps learning from every conversation through its Mind
        engine.
      </p>

      <h2>What you can do here</h2>
      <ul>
        <li>Chat with an AI assistant that can research, plan and write complete projects.</li>
        <li>Build and preview websites and apps live, then improve them version by version.</li>
        <li>Edit and enhance your images by uploading them into the chat.</li>
        <li>Share your builds in the community feed, follow other builders and message them in-app.</li>
        <li>Earn NQAI reward points for daily activity and invites.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        NO QUIT AI is built and maintained by an independent team led by Imran Jamil Ahmad. We ship
        improvements continuously based on what our community asks for.
      </p>

      <h2>Contact us</h2>
      <ul>
        <li>
          Support and general questions:{" "}
          <a className="underline" href="mailto:noquitai1@gmail.com">noquitai1@gmail.com</a>
        </li>
        <li>
          Privacy and data requests:{" "}
          <a className="underline" href="mailto:noquitai1@gmail.com">noquitai1@gmail.com</a>
        </li>
      </ul>
      <p>We usually reply within 2 business days.</p>
    </LegalPage>
  );
}
