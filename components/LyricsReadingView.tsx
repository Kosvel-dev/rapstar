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
    <div className={compact ? "space-y-1 text-sm" : "space-y-2"}>
      {lines.map((line, i) => (
        <div
          key={`${i}-${line.text}`}
          className={line.isSectionHeader ? "pt-2 font-medium text-amber-400" : ""}
        >
          <p className="leading-relaxed text-zinc-100">{line.text}</p>
          {line.showReading && (
            <p className="mt-0.5 font-mono text-xs leading-relaxed text-sky-400/90">
              {line.reading}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
