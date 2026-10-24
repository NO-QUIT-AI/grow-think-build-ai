import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";
import { AdSlot } from "@/components/ads/AdSlot";

const EMAIL = "ranaimranp2@gmail.com";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — NO QUIT AI" },
      {
        name: "description",
        content:
          "Contact the NO QUIT AI team for support, feedback, privacy requests, partnerships or reporting abuse.",
      },
      { property: "og:title", content: "Contact Us — NO QUIT AI" },
      {
        property: "og:description",
        content: "How to reach the NO QUIT AI team and what to include in your message.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

function Mail() {
  return (
    <a className="underline" href={`mailto:${EMAIL}`}>
      {EMAIL}
    </a>
  );
}

function Contact() {
  return (
    <LegalPage title="Contact Us" updated="14 October 2026">
      <p>
        We are a small independent team, and every message we receive is read by a real person.
        Whether you have found a bug, need help with your account, want to suggest a feature or
        simply want to tell us what you built, we would love to hear from you. This page explains
        the best way to reach us and how to get a faster, more useful reply.
      </p>

      <h2>Email</h2>
      <p>
        The main way to contact NO QUIT AI is by email at <Mail />. We use one inbox for all
        topics so that nothing gets lost. Please write in English, Roman Urdu, Urdu, Hindi or
        Arabic — whichever is most comfortable for you. We usually reply within two business days.
        During busy periods, such as after a major update, it may take a little longer, but we
        answer every genuine message.
      </p>

      <h2>Technical support</h2>
      <p>
        If something is not working, please tell us what you were trying to do, what you expected
        to happen and what actually happened. Include the page you were on (for example the chat,
        Studio, CV Maker, Community or Earn Points page), the device and browser you use, and a
        screenshot or short screen recording if possible. Never send us your password — we will
        never ask for it, and our team does not need it to help you.
      </p>
      <p>
        Many common questions are answered in our <Link to="/blog" className="underline">blog guides</Link>,
        including how to build a website through chat, how to make a professional CV and how to
        write better prompts. It is worth checking those first, as you may find an answer
        immediately.
      </p>

      <h2>Account and privacy requests</h2>
      <p>
        You can ask us for a copy of your data, request corrections or ask us to delete your account
        and all related content. Please send the request from the email address linked to your
        account so we can confirm it is really you. We complete deletion requests within 30 days.
        For more detail about what we store and why, read our{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <h2>Reporting abuse or unsafe content</h2>
      <p>
        NO QUIT AI includes a community feed and direct messages between accepted friends. If you
        see content that is hateful, harassing, sexual, violent, a scam or otherwise against our{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>, please email us with the
        username, a link or screenshot of the content, and a short description. We review reports
        carefully and may remove content or suspend accounts that break the rules. Reports are
        kept confidential.
      </p>

      <h2>Feedback and feature ideas</h2>
      <p>
        Most of the features in NO QUIT AI — the CV Maker, the history drawer in chat, friend-only
        messaging and multi-language support — started as suggestions from users. If you have an
        idea, describe the problem you want to solve rather than only the solution. Knowing the
        "why" helps us design something that works for everyone.
      </p>

      <h2>Business, partnerships and press</h2>
      <p>
        For collaborations, education partnerships, media questions or advertising enquiries, email
        us with a short introduction about you or your organisation and what you have in mind. We
        are especially interested in projects that help students, freelancers and small businesses
        in South Asia and the Middle East get online.
      </p>

      <h2>What we cannot help with</h2>
      <p>
        We cannot provide legal, medical or financial advice, and we cannot exchange NQAI points for
        money — they are in-app reward points with no monetary value. We also cannot recover
        content you deleted yourself. Thank you for helping us build a friendly, useful place to
        create with AI.
      </p>
      <AdSlot name="footer" className="mt-6" />
    </LegalPage>
  );
}
