import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  LANGUAGES,
  translations,
  type Lang,
  type TranslationKey,
} from "@/i18n/translations";

const STORAGE_KEY = "nqai_lang";

type LanguageValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageValue | null>(null);

function isLang(value: string | null): value is Lang {
  return !!value && LANGUAGES.some((l) => l.code === value);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the saved language after hydration to avoid SSR mismatches.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) setLangState(saved);
  }, []);

  const dir: "ltr" | "rtl" =
    LANGUAGES.find((l) => l.code === lang)?.dir === "rtl" ? "rtl" : "ltr";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) => {
      const template = translations[lang][key] ?? translations.en[key] ?? key;
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
