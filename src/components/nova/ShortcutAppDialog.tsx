import { Download, ExternalLink, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadShortcutApp, openShortcutAppPreview } from "@/lib/shortcut-app";

export type ShortcutTarget = { name: string; html: string };

export function ShortcutAppDialog({
  target,
  onOpenChange,
}: {
  target: ShortcutTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" /> Shortcut App
          </DialogTitle>
          <DialogDescription className="text-xs">
            {target?.name} ko installable app bana diya — icon, splash colour aur full-screen mode
            sab andar hain.
          </DialogDescription>
        </DialogHeader>

        <ol className="ml-4 list-decimal space-y-1.5 text-xs text-muted-foreground">
          <li>Neeche se app open ya download karo.</li>
          <li>
            Android/Chrome: menu <span className="text-foreground">⋮ → Add to Home screen</span>.
          </li>
          <li>
            iPhone/Safari: <span className="text-foreground">Share → Add to Home Screen</span>.
          </li>
          <li>Home screen pe NO QUIT AI wala icon aa jayega — tap karo, full-screen app khulega.</li>
        </ol>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => target && openShortcutAppPreview(target)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> App kholo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1 text-xs"
            onClick={() => target && downloadShortcutApp(target)}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
