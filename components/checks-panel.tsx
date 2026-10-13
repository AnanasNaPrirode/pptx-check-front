"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IssueMark } from "@/components/issue-mark";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import type { CheckDefinition } from "@/lib/types";

export function ChecksPanel({
  checks,
  enabled,
  disabled,
  status,
  onToggle,
  onRetry,
}: {
  checks: CheckDefinition[];
  enabled: Record<string, boolean>;
  disabled: boolean;
  status: "loading" | "ready" | "error";
  onToggle: (id: string, value: boolean) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
          data-testid="checks-toggle"
        >
          {t("checks.title")}
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        {status === "loading" ? (
          <p className="px-4 pb-3 text-sm text-muted-foreground">{t("checks.loading")}</p>
        ) : null}
        {status === "error" ? (
          <div className="flex flex-wrap items-center gap-3 px-4 pb-4" data-testid="checks-error">
            <p className="text-sm">{t("checks.loadFailed")}</p>
            <button
              type="button"
              className="text-sm font-medium underline"
              data-testid="checks-retry"
              onClick={onRetry}
            >
              {t("checks.retry")}
            </button>
          </div>
        ) : null}
        <CollapsibleContent>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {status === "ready"
              ? checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-3"
                    data-testid={`check-row-${check.id}`}
                  >
                    <Switch
                      className="mt-0.5"
                      checked={Boolean(enabled[check.id])}
                      disabled={disabled}
                      data-testid={`check-switch-${check.id}`}
                      aria-label={check.name}
                      onCheckedChange={(value) => onToggle(check.id, value)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <IssueMark level={check.level} />
                        <span className="font-medium">{check.name}</span>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {check.description}
                      </span>
                    </span>
                  </div>
                ))
              : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
