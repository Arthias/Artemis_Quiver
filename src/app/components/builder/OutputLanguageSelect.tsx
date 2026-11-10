import { useTranslation } from "react-i18next";
import { OUTPUT_LANGUAGES } from "../../services/prompts";

/** Picks the language a generated document is written in, independent of the UI language. */
export function OutputLanguageSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { t, i18n } = useTranslation();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const name = (code: string) => {
    const n = names.of(code) ?? code;
    return n.charAt(0).toLocaleUpperCase(i18n.language) + n.slice(1);
  };

  return (
    <div>
      <label htmlFor="output-language" className="block text-sm font-medium mb-1">{t("builder.outputLanguage")}</label>
      <select
        id="output-language"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm"
      >
        {OUTPUT_LANGUAGES.map((code) => (
          <option key={code} value={code}>{name(code)}</option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground mt-1">{t("builder.outputLanguageHint")}</p>
    </div>
  );
}
