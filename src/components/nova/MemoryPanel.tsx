import { useEffect, useState } from "react";
import { BrainCircuit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";

type Knowledge = {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  confidence: number;
  created_at: string;
};

export function MemoryPanel({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const t = useT();
  const [items, setItems] = useState<Knowledge[]>([]);

  useEffect(() => {
    supabase
      .from("knowledge")
      .select("id, topic, content, tags, confidence, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Knowledge[]) ?? []));
  }, [userId, refreshKey]);

  async function remove(id: string) {
    await supabase.from("knowledge").delete().eq("id", id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-3 pb-6">
      <div className="panel flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm">
          <BrainCircuit className="h-4 w-4 text-primary" />
           {t("savedMemory")}
        </div>
        <span className="text-2xl font-semibold text-gradient">{items.length}</span>
      </div>

      {items.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">
           {t("emptyMemory")}
        </p>
      )}

      {items.map((item) => (
        <article key={item.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">{item.topic}</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{item.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
              >
                #{tag}
              </span>
            ))}
            <span className="ml-auto text-[11px] text-accent">
               {t("confidence")} {Math.round(item.confidence * 100)}%
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
