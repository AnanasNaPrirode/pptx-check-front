"use client";

import { Loader2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function Dropzone({
  disabled,
  checking,
  dragOver,
  message,
  onDragState,
  onFile,
}: {
  disabled: boolean;
  checking: boolean;
  dragOver: boolean;
  message: string | null;
  onDragState: (active: boolean) => void;
  onFile: (file: File) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = disabled || checking;

  return (
    <div
      data-testid="dropzone"
      data-dragover={dragOver ? "true" : "false"}
      aria-busy={checking}
      className={`relative flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center ${
        dragOver ? "border-primary bg-accent" : "border-border bg-card"
      } ${blocked ? "pointer-events-none" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!blocked) onDragState(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!blocked) onDragState(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragState(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragState(false);
        if (blocked) return;
        const file = event.dataTransfer.files.item(0);
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        data-testid="file-input"
        className="sr-only"
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        disabled={blocked}
        onChange={(event) => {
          const file = event.target.files?.item(0);
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <p className="text-base font-medium">{t("dropzone.title")}</p>
      <p className="max-w-md text-sm text-muted-foreground">{t("dropzone.hint")}</p>
      <Button
        type="button"
        variant="outline"
        disabled={blocked}
        onClick={() => inputRef.current?.click()}
      >
        {t("dropzone.browse")}
      </Button>
      {message ? (
        <p className="max-w-md text-sm text-issue-error" data-testid="file-error" role="alert">
          {message}
        </p>
      ) : null}
      {checking ? (
        <div
          data-testid="checking"
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/80"
        >
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm font-medium">{t("dropzone.checking")}</span>
        </div>
      ) : null}
    </div>
  );
}
