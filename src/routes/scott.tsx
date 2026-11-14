import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/scott")({
  beforeLoad: () => {
    throw redirect({ to: "/scout", statusCode: 301 });
  },
});
