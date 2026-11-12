import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fa from "./locales/fa.json";
import ps from "./locales/ps.json";

// Maps a language code to its text direction. Dari (fa) and Pashto (ps)
// both use the Arabic script and are right-to-left; English is LTR.
export const RTL_LANGUAGES = ["fa", "ps"];

export const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "languages.en", dir: "ltr", flag: "🇬🇧" },
  { code: "fa", labelKey: "languages.fa", dir: "rtl", flag: "🇦🇫" },
  { code: "ps", labelKey: "languages.ps", dir: "rtl", flag: "🇦🇫" },
];

export const isRTL = (lang) => RTL_LANGUAGES.includes(lang);

export const getDirection = (lang) => (isRTL(lang) ? "rtl" : "ltr");

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fa: { translation: fa },
      ps: { translation: ps },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fa", "ps"],
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "clinic_lang",
      caches: ["localStorage"],
    },
    returnObjects: true,
  });

// Keep the <html lang=...> and <html dir=...> attributes in sync with the
// active language so CSS logical properties (ms-, me-, ps-, pe-) flip the
// layout automatically and screen readers pronounce content correctly.
const applyHtmlAttributes = (lang) => {
  if (typeof document === "undefined") return;
  const dir = getDirection(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  document.body.classList.toggle("font-rtl", dir === "rtl");
};

applyHtmlAttributes(i18n.language?.split("-")[0] || "en");

i18n.on("languageChanged", (lang) => {
  applyHtmlAttributes(lang?.split("-")[0] || "en");
});

export default i18n;
