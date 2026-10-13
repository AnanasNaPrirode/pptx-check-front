"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChecksPanel } from "@/components/checks-panel";
import { Dropzone } from "@/components/dropzone";
import { countIssues, ReportView } from "@/components/report-view";
import { SiteHeader } from "@/components/site-header";
import {
  CheckRequestError,
  fetchChecks,
  submitCheck,
  validateFile,
} from "@/lib/api";
import { getSetting, historyKey, logEvent, saveHistory, setSetting } from "@/lib/db";
import i18n, { detectLocale, isLocale, type Locale } from "@/lib/i18n";
import type { ApiErrorCode, CheckDefinition, CheckReport } from "@/lib/types";

function mergeEnabled(
  checks: CheckDefinition[],
  saved: Record<string, boolean> | null,
) {
  const next: Record<string, boolean> = {};
  for (const check of checks) {
    next[check.id] =
      saved && Object.prototype.hasOwnProperty.call(saved, check.id)
        ? Boolean(saved[check.id])
        : check.default_enabled;
  }
  return next;
}

export function CheckerApp() {
  const { t } = useTranslation();
  const [locale, setLocale] = useState<Locale>("ru");
  const [checksStatus, setChecksStatus] = useState<"loading" | "ready" | "error">("loading");
  const [checks, setChecks] = useState<CheckDefinition[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);

  const applyLocale = useCallback(async (next: Locale, persist: boolean) => {
    await i18n.changeLanguage(next);
    document.documentElement.lang = next;
    setLocale(next);
    if (persist) {
      await setSetting("locale", next);
      await logEvent("locale_changed", { locale: next });
    }
  }, []);

  const loadChecks = useCallback(async () => {
    setChecksStatus("loading");
    try {
      const list = await fetchChecks();
      const saved = await getSetting<Record<string, boolean>>("enabledChecks");
      const merged = mergeEnabled(list, saved);
      setChecks(list);
      setEnabled(merged);
      await setSetting("enabledChecks", merged);
      setChecksStatus("ready");
      return list;
    } catch {
      setChecksStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const savedLocale = await getSetting<string>("locale");
      if (cancelled) return;
      await applyLocale(isLocale(savedLocale) ? savedLocale : detectLocale(), false);
      if (!cancelled) await loadChecks();
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLocale, loadChecks]);

  async function onToggle(id: string, value: boolean) {
    if (checking) return;
    const next = { ...enabled, [id]: value };
    setEnabled(next);
    await setSetting("enabledChecks", next);
    await logEvent("switch_changed", { id, value });
  }

  async function onFile(file: File) {
    if (checking || checksStatus !== "ready") return;
    const clientError = validateFile(file);
    if (clientError) {
      setFileError(t(`errors.${clientError}`));
      await logEvent("check_error", { code: clientError });
      return;
    }

    setChecking(true);
    setFileError(null);
    setDragOver(false);
    const started = performance.now();
    const enabledChecks = checks.filter((check) => enabled[check.id]).map((check) => check.id);
    await logEvent("upload_started", { filename: file.name });

    try {
      const nextReport = await submitCheck(file, enabledChecks);
      const durationMs = Math.round(performance.now() - started);
      const createdAt = new Date().toISOString();
      setReport(nextReport);
      await saveHistory({
        id: await historyKey(file.name, createdAt),
        filename: file.name,
        createdAt,
        durationMs,
        enabledChecks,
        report: nextReport,
      });
      await logEvent("check_success", {
        durationMs,
        slidesCount: nextReport.slides_count,
        issuesCount: countIssues(nextReport),
      });
    } catch (error) {
      const code: ApiErrorCode =
        error instanceof CheckRequestError ? error.code : "INTERNAL_ERROR";
      if (code === "UNKNOWN_CHECK") await loadChecks();
      const retryAfter = error instanceof CheckRequestError ? error.retryAfter : null;
      setFileError(
        code === "RATE_LIMITED"
          ? retryAfter === null
            ? t("errors.RATE_LIMITED_UNKNOWN")
            : t("errors.RATE_LIMITED", { seconds: retryAfter })
          : t(`errors.${code}`),
      );
      await logEvent("check_error", { code });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        locale={locale}
        showNewCheck={report !== null}
        onLocale={(next) => void applyLocale(next, true)}
        onTheme={(theme) => {
          void logEvent("theme_changed", { theme });
        }}
        onNewCheck={() => {
          setReport(null);
          setFileError(null);
        }}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <ChecksPanel
          checks={checks}
          enabled={enabled}
          disabled={checking || checksStatus !== "ready"}
          status={checksStatus}
          onToggle={(id, value) => void onToggle(id, value)}
          onRetry={() => void loadChecks()}
        />
        {report ? (
          <ReportView report={report} />
        ) : checksStatus === "ready" || checking ? (
          <Dropzone
            disabled={checksStatus !== "ready"}
            checking={checking}
            dragOver={dragOver}
            message={fileError}
            onDragState={setDragOver}
            onFile={(file) => void onFile(file)}
          />
        ) : null}
      </main>
    </div>
  );
}
