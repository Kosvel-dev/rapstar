"use client";

import type { AnnotatedLyricLine } from "@/lib/reading/annotateLyrics";

export function LyricsReadingView({
  lines,
  compact = false,
}: {
  lines: AnnotatedLyricLine[];
  compact?: boolean;
}) {
  if (lines.length === 0) return null;

  return (
    <div className={`min-w-0 ${compact ? "space-y-1 text-sm" : "space-y-2"}`}>
      {lines.map((line, i) => (
        <div
          key={`${i}-${line.text}`}
          className={line.isSectionHeader ? "pt-2 font-medium text-amber-400" : ""}
        >
          <p className="break-words text-sm leading-relaxed text-zinc-100">
            {line.text}
          </p>
          {line.showReading && (
            <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-sky-400/90 sm:text-xs">
              {line.reading}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
