import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

type LocaleModule = Record<string, string | Record<string, unknown>>;

const modules = import.meta.glob<LocaleModule>("./locales/*.json", {
  eager: true,
  import: "default",
});

const resources = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => {
    const lang = path.match(/\/(\w+)\.json$/)?.[1] ?? "en";
    return [lang, { common: module as never }];
  })
);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: "common",
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
