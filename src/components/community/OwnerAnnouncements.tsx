import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Announcement = { id: string; title: string; body: string; created_at: string };

export function OwnerAnnouncements({ userId }: { userId: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("community_announcements")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    void load();
    void supabase.rpc("is_owner", { _uid: userId }).then(({ data }) => setIsOwner(data === true));
  }, [load, userId]);

  async function publish() {
    if (!title.trim() || !body.trim()) return toast.error("Title aur message dono likho");
    setBusy(true);
    const { error } = await supabase
      .from("community_announcements")
      .insert({ author_id: userId, title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) return toast.error("Sirf owner announcement kar sakta hai");
    setTitle("");
    setBody("");
    toast.success("Announcement publish ho gayi");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("community_announcements").delete().eq("id", id);
    if (error) return toast.error("Delete nahi hui");
    void load();
  }

  return (
    <div className="mb-4 space-y-3">
      {isOwner && (
        <div className="panel border border-primary/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Shield className="h-4 w-4" /> Admin Panel — Owner Announcement
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="mb-2 h-9 text-sm" maxLength={120} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Sab users ke liye message likho…" rows={3} maxLength={2000} className="mb-2 text-sm" />
          <Button size="sm" onClick={publish} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Announce
          </Button>
        </div>
      )}
      {items.map((a) => (
        <div key={a.id} className="panel border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Megaphone className="h-4 w-4" /> {a.title}
            </div>
            {isOwner && (
              <button type="button" aria-label="Delete announcement" onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{a.body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Official · {new Date(a.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
