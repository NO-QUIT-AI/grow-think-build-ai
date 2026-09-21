import { Languages } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES, type Lang } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSelector({ className }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Languages className="h-4 w-4 text-muted-foreground" />
      <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
        <SelectTrigger className="h-8 w-[130px] text-xs" aria-label={t("language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((item) => (
            <SelectItem key={item.code} value={item.code} className="text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
