"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

export function SiteHeader({
  locale,
  showNewCheck,
  onLocale,
  onTheme,
  onNewCheck,
}: {
  locale: Locale;
  showNewCheck: boolean;
  onLocale: (locale: Locale) => void;
  onTheme: (theme: "light" | "dark") => void;
  onNewCheck: () => void;
}) {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <h1 className="mr-auto text-base font-semibold sm:text-lg">{t("app.title")}</h1>
      {showNewCheck ? (
        <Button type="button" data-testid="new-check" onClick={onNewCheck}>
          {t("app.newCheck")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        data-testid="locale-toggle"
        aria-label={t("app.language")}
        onClick={() => onLocale(locale === "ru" ? "en" : "ru")}
      >
        {locale === "ru" ? "EN" : "RU"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        data-testid="theme-toggle"
        aria-label={t("app.theme")}
        onClick={() => {
          const next = dark ? "light" : "dark";
          setTheme(next);
          onTheme(next);
        }}
      >
        {dark ? <Sun /> : <Moon />}
      </Button>
    </header>
  );
}
