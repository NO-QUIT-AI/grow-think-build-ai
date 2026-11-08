import { Check, Code2, Database, Loader2, Square, Wrench, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenesisToolApproval } from "./GenesisUpgrade";
import type { BuildActivity } from "@/lib/build-activity";

export function LiveBuildProgress({ activity }: { activity: BuildActivity }) {
  const busy = activity.status === "submitted" || activity.status === "streaming";
  return <section aria-label="Live build progress" className="min-w-0 space-y-4 border-b border-border py-4">
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 font-semibold"><Code2 className="h-5 w-5 text-primary" /> Build in progress</h2><p className="mt-1 break-words text-sm text-muted-foreground">{activity.prompt}</p></div>
      {busy && <Button size="icon" variant="ghost" aria-label="Stop build" title="Stop build" onClick={activity.cancel}><Square className="h-4 w-4" /></Button>}
    </header>
    <div role="status" className="flex items-center gap-2 text-sm text-primary">
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : activity.error ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      {activity.error ? "Build interrupted" : busy ? activity.steps.length ? "Tools aur coding par kaam ho raha hai…" : "Request par kaam shuru ho raha hai…" : activity.steps.some(s => s.output.planId || s.output.costApprovalId) ? "Approval / response" : "Response received"}
    </div>
    {activity.error && <p role="alert" className="break-words text-sm text-destructive">{activity.error}</p>}
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
        <ol className="space-y-2">{activity.steps.map(step => <li key={step.id} className="min-w-0 border-l-2 border-primary/40 pl-3">
          <div className="flex items-center gap-2 text-sm">{step.table ? <Database className="h-4 w-4 shrink-0 text-primary" /> : <Wrench className="h-4 w-4 shrink-0 text-primary" />}<span className="min-w-0 break-words">{step.tool.replaceAll("_", " ")}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{step.state === "output-error" ? "Error" : step.state === "output-available" ? "Done" : "Running"}</span></div>
          {(step.file || step.table) && <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{step.table ? `Table: ${step.table}` : step.file}</p>}
          <GenesisToolApproval output={step.output} disabled={busy} onPlanApproved={id => activity.approvePlan?.(id)} onCostApproved={(id, tool) => activity.approveCost?.(id, tool)} />
        </li>)}</ol>
        {activity.text && <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">{activity.text}</p>}
      </div>
      <div className="min-w-0"><h3 className="mb-2 text-xs font-medium text-muted-foreground">Live code</h3><pre aria-label="Live generated code" className="h-80 overflow-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs leading-5">{activity.code || "Waiting for code…"}</pre></div>
    </div>
  </section>;
}