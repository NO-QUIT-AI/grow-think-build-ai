import { useEffect, useState } from "react";
import { Globe, Layers } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type DomainName = { name: string; extension: string; reason: string };

type Blueprint = {
  name: string;
  summary: string;
  screens: { title: string; purpose: string }[];
  features: string[];
  data_model: { table: string; fields: string[] }[];
  tech_stack: string[];
  roadmap: string[];
};

type Artifact = {
  id: string;
  kind: string;
  title: string;
  content: { brief?: string; names?: DomainName[] } & Partial<Blueprint>;
  created_at: string;
};

export function BuildsPanel({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [items, setItems] = useState<Artifact[]>([]);

  useEffect(() => {
    supabase
      .from("artifacts")
      .select("id, kind, title, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as unknown as Artifact[]) ?? []));
  }, [userId, refreshKey]);

  if (items.length === 0) {
    return (
      <p className="px-1 pt-2 text-sm text-muted-foreground">
        Abhi kuch bana nahi. NOVA se kaho: “mujhe domain bana do” ya “ek app ka structure bna do”.
      </p>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      {items.map((item) => (
        <article key={item.id} className="panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {item.kind === "domains" ? (
              <Globe className="h-4 w-4 text-primary" />
            ) : (
              <Layers className="h-4 w-4 text-accent" />
            )}
            {item.title}
          </div>

          {item.kind === "domains" ? (
            <ul className="space-y-2">
              {(item.content.names ?? []).map((entry) => (
                <li key={entry.name} className="rounded-xl bg-secondary/60 px-3 py-2">
                  <p className="text-sm font-medium">
                    {entry.name}
                    <span className="text-primary">{entry.extension}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{item.content.summary}</p>
              <Section title="Screens">
                {(item.content.screens ?? []).map((screen) => (
                  <li key={screen.title}>
                    <span className="font-medium">{screen.title}</span> — {screen.purpose}
                  </li>
                ))}
              </Section>
              <Section title="Features">
                {(item.content.features ?? []).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </Section>
              <Section title="Data model">
                {(item.content.data_model ?? []).map((table) => (
                  <li key={table.table}>
                    <span className="font-medium">{table.table}</span>: {table.fields.join(", ")}
                  </li>
                ))}
              </Section>
              <Section title="Roadmap">
                {(item.content.roadmap ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </Section>
              <div className="flex flex-wrap gap-1.5">
                {(item.content.tech_stack ?? []).map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="ml-4 list-disc space-y-1 text-muted-foreground">{children}</ul>
    </div>
  );
}
