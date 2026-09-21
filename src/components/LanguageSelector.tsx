import { Languages } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES, type Lang } from "@/i18n/translations";

export function LanguageSelector({ className }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Languages className="h-4 w-4 text-muted-foreground" />
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label={t("language")}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
