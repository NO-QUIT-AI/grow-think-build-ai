import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/delete-data")({
  head: () => ({
    meta: [
      { title: "Delete My Data — NO QUIT AI" },
      {
        name: "description",
        content:
          "Request deletion of specific NO QUIT AI data without deleting your full account. Email support@noquital.com and data is removed within 7 days.",
      },
      { property: "og:title", content: "Delete My Data — NO QUIT AI" },
      {
        property: "og:description",
        content:
          "Request partial deletion of specific NO QUIT AI data without deleting your full account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeleteData,
});

function DeleteData() {
  return (
    <LegalPage title="Delete My Data" updated="3 November 2026">
      <p>
        If you want to delete specific data from your NO QUIT AI account
        without deleting your full account, please follow these steps:
      </p>
      <ol className="ml-4 list-decimal space-y-1">
        <li>
          Send an email to{" "}
          <a href="mailto:support@noquital.com" className="text-primary underline">
            support@noquital.com
          </a>{" "}
          from your registered email address.
        </li>
        <li>Subject: &quot;Delete My Data - NO QUIT AI&quot;</li>
        <li>
          Include your username/email in body and mention which data you want
          deleted (for example: saved websites, AI generated builds, chat
          history, or profile data).
        </li>
      </ol>

      <h2>What data can be deleted</h2>
      <ul>
        <li>Saved websites and AI generated builds</li>
        <li>Chat history, memories, and profile data</li>
        <li>Any other specific data you name in your request</li>
        <li>Requested data will be deleted within 7 days.</li>
      </ul>

      <p>
        Your account stays active — only the data you ask for is removed. If
        you want to delete your full account instead, visit the{" "}
        <a href="/delete-account" className="text-primary underline">
          Delete Account
        </a>{" "}
        page.
      </p>

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
