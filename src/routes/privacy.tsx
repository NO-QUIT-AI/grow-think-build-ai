import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — NO QUIT AI" },
      {
        name: "description",
        content:
          "How NO QUIT AI collects, uses and protects your account data, chats, community posts and advertising cookies.",
      },
      { property: "og:title", content: "Privacy Policy — NO QUIT AI" },
      {
        property: "og:description",
        content: "Data we collect, how we use it, third-party services and your rights on NO QUIT AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="19 September 2026">
      <p>
        NO QUIT AI ("we", "us") is an AI workspace where people chat with an AI assistant, build
        websites and apps, share their work in a community feed and earn NQAI reward points. This
        policy explains what we collect and how we use it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account data: email address, display name, username, avatar and bio.</li>
        <li>Content you create: chat messages, prompts, generated projects, uploaded images, community posts, comments and direct messages.</li>
        <li>Activity data: NQAI coin balance, mining history, invites and reputation points.</li>
        <li>Technical data: browser type, device type, approximate region and basic log data used for security and troubleshooting.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the AI assistant, builder, community feed and messaging features.</li>
        <li>To operate the NQAI reward system and prevent abuse of it.</li>
        <li>To keep the service secure, debug problems and improve features.</li>
        <li>To show advertising that keeps the service free.</li>
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Hosting and database:</strong> our infrastructure provider stores your account and content securely.</li>
        <li><strong>AI models:</strong> prompts you send are processed by AI model providers to generate replies, images and code.</li>
        <li><strong>Google AdSense:</strong> Google and its partners may use cookies to serve ads based on your visits to this and other sites. You can opt out of personalised advertising at <a className="underline" href="https://www.google.com/settings/ads">google.com/settings/ads</a>, and learn more at <a className="underline" href="https://policies.google.com/technologies/ads">Google&apos;s advertising policies</a>.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use essential cookies and local storage to keep you signed in and remember preferences such
        as your last chat thread. Advertising partners may set their own cookies as described above.
        You can clear or block cookies in your browser, though some features may stop working.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your content while your account is active. You can delete individual posts, chats and
        messages at any time. To delete your whole account and its data, email us and we will action
        it within 30 days.
      </p>

      <h2>Children</h2>
      <p>NO QUIT AI is not intended for children under 13, and we do not knowingly collect their data.</p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data, ask us to correct it, or ask us to delete it by
        contacting us at <a className="underline" href="mailto:support@noquitai.com">support@noquitai.com</a>.
      </p>
    </LegalPage>
  );
}
