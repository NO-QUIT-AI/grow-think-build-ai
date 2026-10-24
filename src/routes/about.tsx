import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";
import { AdSlot } from "@/components/ads/AdSlot";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Contact — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI builds websites and apps from a simple chat, with a builder community and NQAI rewards. Contact the team here.",
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
        NO QUIT AI is a build studio. You describe an idea in plain language — in
        English or Roman Urdu — and the assistant builds a website or app, shows a
        live preview in the Studio, and remembers your projects so you can improve
        them version by version.
      </p>
      <p>
        We started NO QUIT AI because we saw how many talented people — students, freelancers,
        shop owners, teachers and job seekers — had good ideas but no easy way to put them online.
        Learning to code takes months, hiring a developer costs money, and most tools assume you
        are comfortable working only in English. We wanted a place where anyone could simply
        explain what they need, in the language they think in, and get a real, working result.
      </p>

      <h2>Our mission</h2>
      <p>
        Our mission is to make building with AI simple, honest and accessible. The name comes from
        a belief we hold strongly: most projects do not fail because the idea is bad, they fail
        because people stop after the first difficult step. NO QUIT AI is designed to keep you
        moving — build a first version, look at it, improve it, and keep going until it is ready.
      </p>

      <h2>What you can do here</h2>
      <ul>
        <li>Chat with an AI assistant that can research, plan and write complete projects.</li>
        <li>Build and preview websites and apps live, then improve them version by version.</li>
        <li>Create a professional CV with themes, photo upload, AI wording polish and PDF download.</li>
        <li>Edit and enhance your images by uploading them into the chat.</li>
        <li>Talk to the assistant by voice in a natural, conversational way.</li>
        <li>Share your builds in the community feed, follow other builders and message accepted friends in-app.</li>
        <li>Earn NQAI reward points for activity and invites (points have no monetary value).</li>
        <li>Read practical guides on our <Link to="/blog" className="underline">blog</Link>.</li>
      </ul>

      <h2>Who it is for</h2>
      <p>
        NO QUIT AI is built for beginners first. A university student can make a portfolio before
        an internship interview. A home baker can create a menu page with a WhatsApp order button.
        A job seeker can turn rough notes into a clean CV. At the same time, more experienced users
        can use the assistant to speed up planning, writing and prototyping. The app supports
        English, Urdu, Hindi and Arabic, with right-to-left layout for Arabic.
      </p>

      <h2>Our values</h2>
      <ul>
        <li>Honesty: AI output can be wrong, so we encourage users to review everything before relying on it.</li>
        <li>Privacy: we collect only what is needed to run the service, and you can ask us to delete your data.</li>
        <li>Safety: the community has clear rules against harassment, scams and adult content, and messages are limited to accepted friends.</li>
        <li>Respect for users: no fake promises — NQAI points are rewards for fun and engagement, not an investment.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        NO QUIT AI is built and maintained by an independent team led by Imran Jamil Ahmad. We ship
        improvements continuously based on what our community asks for. Many features, including
        the CV Maker, chat history and friend-only messaging, started as user suggestions.
      </p>

      <h2>How the service is funded</h2>
      <p>
        NO QUIT AI is free to use and is supported by advertising. We place ads in clearly labelled
        areas and keep them away from sign-in pages and the main editing tools so they do not get in
        your way. You can learn more about advertising cookies in our{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <h2>Contact us</h2>
      <ul>
        <li>
          Support and general questions:{" "}
          <a className="underline" href="mailto:ranaimranp2@gmail.com">ranaimranp2@gmail.com</a>
        </li>
        <li>
          Privacy and data requests:{" "}
          <a className="underline" href="mailto:ranaimranp2@gmail.com">ranaimranp2@gmail.com</a>
        </li>
      </ul>
      <p>
        We usually reply within 2 business days. See the full{" "}
        <Link to="/contact" className="underline">Contact page</Link> for tips on getting a faster answer.
      </p>
      <AdSlot name="footer" className="mt-6" />
    </LegalPage>
  );
}
