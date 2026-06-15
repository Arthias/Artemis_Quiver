import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const LANGUAGES = [
  { value: "en", labelKey: "config.languageEN" },
  { value: "es", labelKey: "config.languageES" },
];

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  return (
    <Select
      value={i18n.language?.startsWith("es") ? "es" : "en"}
      onValueChange={(v) => i18n.changeLanguage(v)}
    >
      <SelectTrigger className="w-[140px] bg-input-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[200]">
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {t(lang.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
