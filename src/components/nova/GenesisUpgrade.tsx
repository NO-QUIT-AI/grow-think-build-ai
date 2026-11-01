import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Play, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmGenesisPatch, confirmGenesisPlan, genesisBudget, setGenesisBudget } from "@/lib/genesis-super.functions";

export function GenesisUsage({revision}:{revision:number}) {
  const load=useServerFn(genesisBudget),save=useServerFn(setGenesisBudget);
  const [usage,setUsage]=useState<{usd:number;budget:number}|null>(null);
  const [open,setOpen]=useState(false),[value,setValue]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void load().then(data=>{if(active)setUsage(data);}).catch(()=>{if(active)setUsage(null);});return()=>{active=false;};},[load,revision]);
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-2 text-xs">
    <span className="text-muted-foreground">Is mahine {usage?`~$${usage.usd.toFixed(2)} / budget $${usage.budget.toFixed(2)}`:"Usage unavailable"} <span className="text-[10px]">(tool estimates)</span></span>
    <Button variant="ghost" size="icon" aria-label="Monthly budget" title="Monthly budget" onClick={()=>{setValue(String(usage?.budget??0));setOpen(!open);}}><Settings2 className="h-4 w-4"/></Button>
    {open && <form className="flex w-full items-center gap-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try {const usd=Number(value);if(!Number.isFinite(usd)||usd<0)throw new Error("Valid budget do");await save({data:{usd}});setUsage(await load());setOpen(false);toast.success("Monthly budget saved");} catch(e){toast.error(e instanceof Error?e.message:"Budget save failed");}finally{setBusy(false);}}}><label htmlFor="genesis-budget">Budget $</label><Input id="genesis-budget" type="number" min="0" max="10000" step="0.01" value={value} onChange={e=>setValue(e.target.value)} className="h-8 flex-1"/><Button size="sm" disabled={busy}>Save</Button></form>}
  </div>;
}
type ToolOutput={patchId?:string;planId?:string;steps?:string[];targetFile?:string;previousContent?:string;newContent?:string;error?:string;budgetBlocked?:boolean};
export function GenesisToolApproval({output,onPlanApproved}:{output:ToolOutput;onPlanApproved:(id:string)=>void}) {
  const patch=useServerFn(confirmGenesisPatch),plan=useServerFn(confirmGenesisPlan);
  const [done,setDone]=useState(false),[busy,setBusy]=useState(false);
  if(output.budgetBlocked) return <p role="alert" className="my-2 text-xs text-destructive">{output.error}</p>;
  if(!output.patchId && !output.planId) return null;
  return <section className="my-3 space-y-2 rounded-md border border-primary/40 bg-background p-3">
    {output.patchId?<><h3 className="text-sm font-semibold">Patch preview · {output.targetFile}</h3><div className="grid gap-2 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Before</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-border p-2 text-xs">{output.previousContent||"(default configuration)"}</pre></div><div><p className="text-xs text-primary">After</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-primary/40 p-2 text-xs">{output.newContent||"(default configuration)"}</pre></div></div></>:<ol className="list-inside list-decimal space-y-1 text-sm">{output.steps?.map((step,index)=><li key={index}>{step}</li>)}</ol>}
    <Button size="sm" disabled={done||busy} onClick={async()=>{setBusy(true);try {if(output.patchId){await patch({data:{id:output.patchId,confirm:true}});toast.success("Patch applied — next reply uses updated configuration");} else if(output.planId){await plan({data:{id:output.planId}});onPlanApproved(output.planId);}setDone(true);}catch(e){toast.error(e instanceof Error?e.message:"Approval failed");}finally{setBusy(false);}}}>{done?<Check className="mr-2 h-4 w-4"/>:<Play className="mr-2 h-4 w-4"/>}{done?"Approved":output.patchId?"Confirm & Apply":"Bolo, shuru karun?"}</Button>
  </section>;
}