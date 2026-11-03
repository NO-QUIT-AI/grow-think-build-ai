import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Account — NO QUIT AI" },
      {
        name: "description",
        content:
          "How to delete your NO QUIT AI account and all associated data: email support@noquital.com from your registered address and your data is removed within 7 days.",
      },
      { property: "og:title", content: "Delete Account — NO QUIT AI" },
      {
        property: "og:description",
        content:
          "Request full deletion of your NO QUIT AI account and all associated data within 7 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeleteAccount,
});

function DeleteAccount() {
  return (
    <LegalPage title="Delete Account" updated="3 November 2026">
      <p>
        If you want to delete your NO QUIT AI account and all associated data,
        please follow these steps:
      </p>
      <ol className="ml-4 list-decimal space-y-1">
        <li>
          Send an email to{" "}
          <a href="mailto:support@noquital.com" className="text-primary underline">
            support@noquital.com
          </a>{" "}
          from your registered email address.
        </li>
        <li>Subject: &quot;Delete My Account - NO QUIT AI&quot;</li>
        <li>Include your username/email in body.</li>
      </ol>

      <h2>What data will be deleted</h2>
      <ul>
        <li>Username, email address, password hash</li>
        <li>Saved websites, AI generated builds, profile data</li>
        <li>All stored data will be deleted within 7 days.</li>
      </ul>

      <h2>Developer &amp; Contact</h2>
      <p>
        Developer: NO QUIT AI / NOQUITAL
        <br />
        Contact:{" "}
        <a href="mailto:support@noquital.com" className="text-primary underline">
          support@noquital.com
        </a>
        <br />
        For any questions, visit{" "}
        <a href="https://noquital.com/contact" className="text-primary underline">
          https://noquital.com/contact
        </a>
      </p>
    </LegalPage>
  );
}
