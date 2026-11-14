import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scottContext, SCOTT_PROMPT } from "./scott-coach";

export const getScottHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("scott_messages").select("id,role,content,created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).reverse();
  });

export const talkToScott = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ message: z.string().trim().min(1).max(6000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: history, error } = await context.supabase.from("scott_messages").select("role,content").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(40);
    if (error) throw error;
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const reply = await generateResponse({ model: "openai/gpt-6-astra", instructions: SCOTT_PROMPT,
      input: [...scottContext((history ?? []).reverse()), { role: "user" as const, content: data.message }], reasoning: { effort: "low" } });
    const text = reply.output.flatMap(item => item.type === "message" ? item.content.flatMap(part => part.type === "output_text" ? [part.text] : []) : []).join("\n");
    if (!text.trim()) throw new Error("Scott ka jawab nahi aaya; aapka message abhi save nahi hua.");
    const { error: saveError } = await context.supabase.from("scott_messages").insert([
      { user_id: context.userId, role: "user", content: data.message },
      { user_id: context.userId, role: "assistant", content: text, created_at: new Date(Date.now() + 1).toISOString() },
    ]);
    if (saveError) throw new Error("Jawab aaya lekin chat save nahi hui; dobara try karein.");
    return { text };
  });