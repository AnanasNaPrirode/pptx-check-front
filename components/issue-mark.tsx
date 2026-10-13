"use client";

import { AlertTriangle, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IssueLevel } from "@/lib/types";
import { cn } from "cn";

export function IssueMark({
  level,
  className,
}: {
  level: IssueLevel;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = level === "error" ? t("checks.error") : t("checks.warning");
  const Icon = level === "error" ? CircleAlert : AlertTriangle;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
        level === "error" ? "text-issue-error" : "text-issue-warning",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          level === "error" ? "bg-issue-error" : "bg-issue-warning",
        )}
      />
    </span>
  );
}
