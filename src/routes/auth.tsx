import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logoAsset from "@/assets/logo.jpg.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to NO QUIT AI" },
      {
        name: "description",
        content:
          "Sign in to NO QUIT AI and build websites, app blueprints and domain names from a simple chat.",
      },
      { property: "og:title", content: "Sign in to NO QUIT AI" },
      {
        property: "og:description",
        content: "Access your NO QUIT AI workspace: builds, Studio and domain names.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const t = useT();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confirmation email bhej di hai — inbox (aur spam) check karke link par click karein, phir login karein.", { duration: 10000 });
          setNeedsConfirm(true);
          setMode("signin");
          return;
        }
         toast.success(t("signup"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            setNeedsConfirm(true);
            throw new Error("Pehle apni email confirm karein — inbox mein link bheja gaya hai.");
          }
          throw error;
        }
      }
      navigate({ to: "/" });
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email) {
      toast.error("Pehle email likhein.");
      return;
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("Confirmation email dobara bhej di gayi.");
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
       toast.error(t("requestFailed"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="NO QUIT AI logo"
            className="h-11 w-11 rounded-2xl border border-border object-cover"
          />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">NO QUIT AI</h1>
            <p className="text-xs text-muted-foreground">{t("studio")}</p>
          </div>
          <LanguageSelector />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth_name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Imran" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth_email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth_password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Password chhupayein" : "Password dikhayein"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? t("login") : t("signup")}
          </Button>
        </form>

        {needsConfirm && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Account on karne ke liye email confirm karna zaroori hai. Email nahi mili?{" "}
            <button type="button" onClick={resendConfirmation} className="font-medium text-primary underline-offset-4 hover:underline">
              Dobara bhejein
            </button>
          </div>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("auth_or")}{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" className="w-full" onClick={google}>
          {t("auth_google")}
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? t("auth_needAccount") : t("auth_haveAccount")}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t("signup") : t("login")}
          </button>
        </p>
      </div>
    </main>
  );
}
