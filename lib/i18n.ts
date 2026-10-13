import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: "ru",
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "ru";
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "ru";
}

export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en";
}

export default i18n;
