import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { partnerUrl, type HdPartner } from "@/lib/hd-upsell";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; images: string[]; story: unknown; reason: string };

export function HdUpsellDialog({ open, onOpenChange, images, story, reason }: Props) {
  function go(partner: HdPartner) {
    // Open tab synchronously (popup blockers), log the click in background.
    window.open(partnerUrl(partner, images, story), "_blank", "noopener,noreferrer");
    void (async () => {
      const { data } = await supabase.auth.getSession();
      await supabase.from("hd_redirect_clicks").insert({ partner, reason, user_id: data.session?.user.id ?? null });
    })();
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Real HD 1 Hour Video ke liye Pro Platform</DialogTitle>
          <DialogDescription>
            Free preview 15 sec tak hai. 1 ghante ki Real HD video (1080p) ke liye aapko hamare partner platform pe jana hoga. Wahan aap khud pay karke apni video download kar sakte ho. Humara platform aapka storyboard aur images wahan auto bhej dega.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="btn-green" onClick={() => go("creatomate")}>Continue to HD Platform</Button>
          <Button variant="outline" onClick={() => go("capcut")}>CapCut pe kholo</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
