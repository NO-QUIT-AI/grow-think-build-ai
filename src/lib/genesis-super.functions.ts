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
  const {data:plan,error}=await context.supabase.from("genesis_plans").select("id,status").eq("id",data.id).eq("user_id",context.userId).single();
  if(error || !plan || plan.status!=="pending") throw new Error("Plan not pending");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {error:updateError}=await supabaseAdmin.from("genesis_plans").update({status:"approved"}).eq("id",plan.id).eq("user_id",context.userId).eq("status","pending");
  if(updateError) throw new Error("Approval could not be saved");
  return {approved:true,id:plan.id};
});
export const genesisBudget=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0);
  const [{data:budget,error:budgetError},{data:usage,error:usageError}]=await Promise.all([
    context.supabase.from("genesis_budgets").select("monthly_usd").eq("user_id",context.userId).maybeSingle(),
    context.supabase.from("usage").select("usd,tokens,status").eq("user_id",context.userId).gte("created_at",month.toISOString()).in("status",["reserved","completed","uncertain"]).limit(10000),
  ]);
  if(budgetError || usageError) throw new Error("Usage could not be loaded");
  return {budget:Number(budget?.monthly_usd??0),usd:(usage??[]).reduce((sum,row)=>sum+Number(row.usd),0),estimated:true};
});
export const setGenesisBudget=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({usd:z.number().min(0).max(10000)}).parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.from("genesis_budgets").upsert({user_id:context.userId,monthly_usd:data.usd,updated_at:new Date().toISOString()});
  if(error) throw new Error("Budget save failed");
  return {saved:true};
});