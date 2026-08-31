import { useEffect, useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { inviteLink } from "@/lib/referral";

export function InviteDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLink(inviteLink(userId));
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", userId)
      .then(({ count: total }) => setCount(total ?? 0));
  }, [open, userId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copy ho gaya");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy nahi ho saka — link manually select karo");
    }
  }

  async function share() {
    const text = `NO QUIT AI join karo — AI jo khud sochti hai aur apps banati hai:\n${link}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "NO QUIT AI", text, url: link });
        return;
      } catch {
        /* user cancelled */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Invite link
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ye link doston ko bhejo — wo sign up kar ke apna NO QUIT AI workspace use kar sakte hain.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
          <Button size="icon" variant="secondary" onClick={() => void copy()} aria-label="Copy link">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <Button size="sm" className="mt-1 gap-1 text-xs" onClick={() => void share()}>
          <Share2 className="h-3.5 w-3.5" /> Share karo
        </Button>

        <p className="text-xs text-muted-foreground">
          {count === null
            ? "Invites load ho rahe hain…"
            : count === 0
              ? "Abhi tak koi join nahi hua — pehla invite bhejo."
              : `${count} log tumhare link se join kar chuke hain.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
