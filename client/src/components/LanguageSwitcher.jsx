import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../i18n/index.js";

// Compact dropdown that lets the user switch the entire UI between English,
// Dari, and Pashto. Persists the choice in localStorage (via i18next language
// detector) so the preference survives refreshes and logouts. When Dari or
// Pashto is picked, the <html dir="rtl"> attribute flips and Tailwind's
// logical properties (ms-, me-, ps-, pe-, start-, end-) take care of
// mirroring paddings, icons, and dropdown sides automatically.
export default function LanguageSwitcher({ compact = false }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = i18n.language?.split("-")[0] || "en";
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === current) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const select = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
        title={t("common.selectLanguage")}
        aria-label={t("common.selectLanguage")}
        aria-expanded={open}
      >
        <Globe size={18} className="shrink-0" />
        {!compact && (
          <span className="text-sm font-medium hidden sm:inline">{currentLang.flag}</span>
        )}
        {!compact && (
          <span className="text-sm hidden md:inline">{t(currentLang.labelKey)}</span>
        )}
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => select(lang.code)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
                current === lang.code
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{lang.flag}</span>
                <span>{t(lang.labelKey)}</span>
              </span>
              {current === lang.code && <Check size={14} className="text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
