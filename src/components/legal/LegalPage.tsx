import { Link } from "@tanstack/react-router";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
        ← NO QUIT AI
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: {updated}</p>
      <div className="prose-sm mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc">
        {children}
      </div>
      <LegalFooter />
    </main>
  );
}

export function LegalFooter({ className }: { className?: string }) {
  return (
    <nav className={`mt-10 flex flex-wrap gap-4 border-t border-border pt-4 text-[11px] text-muted-foreground ${className ?? ""}`}>
      <Link to="/about" className="hover:text-primary">
        About & Contact
      </Link>
      <Link to="/privacy" className="hover:text-primary">
        Privacy Policy
      </Link>
      <Link to="/terms" className="hover:text-primary">
        Terms of Service
      </Link>
    </nav>
  );
}
