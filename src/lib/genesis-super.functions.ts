import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const confirmGenesisPatch=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid(),confirm:z.literal(true)}).parse(input)).handler(async({data,context})=>{
  const {data:owner,error:roleError}=await context.supabase.rpc("is_owner",{_uid:context.userId});
  if(roleError || owner!==true) throw new Error("Owner only");
  const {data:result,error}=await context.supabase.rpc("genesis_confirm_patch",{p_id:data.id});
  if(error) throw new Error(error.message);
  return result;
});
export const confirmGenesisPlan=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc("genesis_approve_action",{p_id:data.id,p_kind:"plan"});
  if(error) throw new Error(error.message);
  return {approved:true,id:data.id};
});
export const confirmGenesisCost=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc("genesis_approve_action",{p_id:data.id,p_kind:"cost"});
  if(error) throw new Error(error.message);
  return {approved:true,id:data.id};
});
export const genesisBudget=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0);
  const [{data:budget,error:budgetError},{data:usage,error:usageError}]=await Promise.all([
    context.supabase.from("genesis_budgets").select("monthly_usd").eq("user_id",context.userId).maybeSingle(),
    context.supabase.from("usage").select("tool,usd,tokens,status").eq("user_id",context.userId).gte("created_at",month.toISOString()).in("status",["reserved","completed","uncertain"]).limit(10000),
  ]);
  if(budgetError || usageError) throw new Error("Usage could not be loaded");
  const tools:Record<string,{calls:number;usd:number}>={};
  for(const row of usage??[]){const entry=tools[row.tool]??{calls:0,usd:0};entry.calls++;entry.usd+=Number(row.usd);tools[row.tool]=entry;}
  return {budget:Number(budget?.monthly_usd??0),usd:(usage??[]).reduce((sum,row)=>sum+Number(row.usd),0),tools,estimated:true};
});
export const setGenesisBudget=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({usd:z.number().min(0).max(10000)}).parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.from("genesis_budgets").upsert({user_id:context.userId,monthly_usd:data.usd,updated_at:new Date().toISOString()});
  if(error) throw new Error("Budget save failed");
  return {saved:true};
});