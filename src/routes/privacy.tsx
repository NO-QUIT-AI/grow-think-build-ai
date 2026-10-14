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
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li>
          <strong>Hosting &amp; Database:</strong> Our hosting provider stores your account and
          content.
        </li>
        <li>
          <strong>AI Provider:</strong> AI prompts you send are processed by our AI provider
          (DeepSeek) to generate responses.
        </li>
        <li>Analytics &amp; Error logging may be used to improve stability.</li>
      </ul>

      <h2>Advertising - Google AdMob</h2>
      <p>We use Google AdMob to show advertisements in our app/website.</p>
      <p>
        Our website also uses Google AdSense. Google AdSense uses cookies to show personalized
        ads based on your visits to this and other websites. You can turn off personalized ads at{' '}
        <a className="underline" href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
          Google Ads Settings
        </a>
        .
      </p>
      <p>
        AdMob may collect and use your device&apos;s Advertising ID, IP address, and other
        information to show personalized or non-personalized ads.
      </p>
      <p>You can opt-out of personalized ads at any time from your device settings:</p>
      <ul>
        <li>
          Android: Settings &gt; Google &gt; Ads &gt; Opt out of Ads Personalization.
        </li>
        <li>iOS: Settings &gt; Privacy &amp; Tracking.</li>
      </ul>
      <p>
        AdMob may use cookies and similar technologies to serve ads. For more information on how
        Google uses your data, please see Google&apos;s{' '}
        <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{' '}
        and Google&apos;s{' '}
        <a className="underline" href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          Ad Technology
        </a>
        .
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies and local storage to keep you signed in and remember preferences
        such as your last chat thread. Advertising partners may set their own cookies as described
        above.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your content while your account is active. You can delete individual posts, chats
        and messages at any time. To delete your whole account and its data, email us and we will
        action it within 30 days.
      </p>

      <h2>Children</h2>
      <p>NO QUIT AI is not intended for children under 13, and we do not knowingly collect their data.</p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data, ask us to correct it, or ask us to delete it by
        contacting us at <a className="underline" href="mailto:ranaimranp2@gmail.com">ranaimranp2@gmail.com</a>.
      </p>

      <h2>Disclaimer on NQAI Points</h2>
      <p>
        NQAI Points are test points for Phase 1 (Pre-Mining) and currently have no monetary value.
        Future NQAI rewards will be based on points collected.
      </p>

      <h2>Contact</h2>
      <p>
        If you have questions about this policy, contact us at:{' '}
        <a className="underline" href="mailto:ranaimranp2@gmail.com">ranaimranp2@gmail.com</a>
      </p>
    </LegalPage>
  );
}
