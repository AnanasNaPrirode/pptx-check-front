"use client";

import { useTranslation } from "react-i18next";
import { IssueMark } from "@/components/issue-mark";
import { SlideCard } from "@/components/slide-card";
import type { CheckReport } from "@/lib/types";

export function countIssues(report: CheckReport) {
  return (
    report.presentation_issues.length +
    report.slides.reduce((total, slide) => total + slide.issues.length, 0)
  );
}

export function ReportView({ report }: { report: CheckReport }) {
  const { t } = useTranslation();
  const issues = countIssues(report);

  return (
    <section data-testid="report" className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("report.file")}</p>
          <p className="truncate font-medium">{report.filename}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("report.slidesCount")}</p>
          <p className="font-medium">{report.slides_count}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("report.issuesCount")}</p>
          <p className="font-medium">{issues === 0 ? t("report.noIssues") : issues}</p>
        </div>
      </div>

      {report.presentation_issues.length > 0 ? (
        <div data-testid="presentation-issues" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-medium">{t("report.presentationIssues")}</h2>
          <ul className="flex flex-col gap-2">
            {report.presentation_issues.map((issue, index) => (
              <li key={`${issue.check_id}-${index}`} className="flex items-start gap-2 text-sm">
                <IssueMark level={issue.level} className="mt-0.5" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {issue.message}
                  {issue.check_id === "slide_duplicates" && issue.slide_numbers?.length ? (
                    <span className="mt-1 block text-muted-foreground">
                      {t("report.slideNumbers", {
                        numbers: issue.slide_numbers.join(", "),
                      })}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {report.slides.map((slide) => (
          <SlideCard key={slide.number} slide={slide} />
        ))}
      </div>
    </section>
  );
}
