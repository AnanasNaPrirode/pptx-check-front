"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IssueMark } from "@/components/issue-mark";
import type { IssueLevel, SlideElement, SlideIssue, SlideReport } from "@/lib/types";

const ELEMENT_LABELS = [
  "picture",
  "video",
  "table",
  "shape",
  "group",
  "placeholder",
  "text",
] as const;

function elementLabelKey(type: string) {
  return ELEMENT_LABELS.find((key) => key === type) ?? "shape";
}

function issueLevelFor(
  elementId: string,
  issues: SlideIssue[],
): IssueLevel | null {
  const related = issues.filter((issue) => issue.element_id === elementId);
  if (related.some((issue) => issue.level === "error")) return "error";
  if (related.length > 0) return "warning";
  return null;
}

function SlideSchematic({
  slide,
  hoveredId,
}: {
  slide: SlideReport;
  hoveredId: string | null;
}) {
  const { t } = useTranslation();
  const width = slide.width_emu > 0 ? slide.width_emu : 1;
  const height = slide.height_emu > 0 ? slide.height_emu : 1;

  return (
    <svg
      data-testid="slide-schematic"
      role="img"
      aria-label={t("report.schematic")}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-lg bg-muted"
    >
      <rect width={width} height={height} className="fill-background" />
      {slide.elements.map((element) => (
        <SchematicElement
          key={element.id}
          element={element}
          level={issueLevelFor(element.id, slide.issues)}
          hovered={hoveredId === element.id}
          label={elementText(element, t)}
        />
      ))}
    </svg>
  );
}

function elementText(
  element: SlideElement,
  t: (key: string) => string,
) {
  if (element.type === "text" || (element.text && element.type === "placeholder")) {
    const line = (element.text ?? "").split(/\r?\n/)[0] ?? "";
    return line || t("element.text");
  }
  return t(`element.${elementLabelKey(element.type)}`);
}

function SchematicElement({
  element,
  level,
  hovered,
  label,
}: {
  element: SlideElement;
  level: IssueLevel | null;
  hovered: boolean;
  label: string;
}) {
  if (element.w <= 0 || element.h <= 0) return null;
  const stroke = level === "error" ? "var(--issue-error)" : level === "warning" ? "var(--issue-warning)" : "var(--border)";
  const fill =
    level && hovered
      ? level === "error"
        ? "color-mix(in oklch, var(--issue-error) 35%, transparent)"
        : "color-mix(in oklch, var(--issue-warning) 40%, transparent)"
      : level
        ? level === "error"
          ? "color-mix(in oklch, var(--issue-error) 16%, transparent)"
          : "color-mix(in oklch, var(--issue-warning) 18%, transparent)"
        : "transparent";

  return (
    <g data-element-id={element.id}>
      <rect
        x={element.x}
        y={element.y}
        width={element.w}
        height={element.h}
        rx={Math.min(element.w, element.h) * 0.04}
        fill={fill}
        stroke={stroke}
        strokeWidth={hovered ? element.w * 0.012 : element.is_title ? element.w * 0.006 : element.w * 0.003}
      />
      <foreignObject x={element.x} y={element.y} width={element.w} height={element.h}>
        <div
          className={`box-border h-full overflow-hidden px-[4%] py-[3%] text-ellipsis whitespace-nowrap ${
            element.is_title ? "font-semibold" : ""
          }`}
          style={{ fontSize: Math.max(element.h * 0.28, 1) }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
}

export function SlideCard({ slide }: { slide: SlideReport }) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <article
      data-testid={`slide-card-${slide.number}`}
      className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:grid-cols-2"
    >
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-medium">{t("report.slide", { number: slide.number })}</h3>
        <SlideSchematic slide={slide} hoveredId={hoveredId} />
      </div>
      <ul data-testid="slide-issues" className="flex min-w-0 flex-col gap-2">
        {slide.issues.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("report.noIssues")}</li>
        ) : (
          slide.issues.map((issue, index) => (
            <li
              key={`${issue.check_id}-${issue.element_id ?? "slide"}-${index}`}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              onMouseEnter={() => setHoveredId(issue.element_id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(issue.element_id)}
              onBlur={() => setHoveredId(null)}
            >
              <IssueMark level={issue.level} className="mt-0.5" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{issue.message}</span>
            </li>
          ))
        )}
      </ul>
    </article>
  );
}
