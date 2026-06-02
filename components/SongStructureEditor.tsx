"use client";

import {
  defaultStructureForArtist,
  newSectionId,
  PRESET_AINT_NO_LOVE,
  PRESET_SIMPLE,
  SECTION_TYPES,
  totalBars,
  type SectionType,
  type SongSectionConfig,
} from "@/lib/llm/songStructure";

type Props = {
  sections: SongSectionConfig[];
  onChange: (sections: SongSectionConfig[]) => void;
  artistSlug: string;
};

export function SongStructureEditor({ sections, onChange, artistSlug }: Props) {
  function updateSection(id: string, patch: Partial<SongSectionConfig>) {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function removeSection(id: string) {
    if (sections.length <= 1) return;
    onChange(sections.filter((s) => s.id !== id));
  }

  function addSection() {
    onChange([
      ...sections,
      { id: newSectionId(), type: "Verse", bars: 8 },
    ]);
  }

  function applyPreset(preset: SongSectionConfig[]) {
    onChange(preset.map((s) => ({ ...s, id: newSectionId() })));
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm text-zinc-400">曲構成（小節数）</label>
        <span className="text-xs text-zinc-500">合計 {totalBars(sections)} 小節</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => applyPreset(PRESET_AINT_NO_LOVE)}
          className="min-h-9 rounded bg-zinc-800 px-2 py-1 text-[11px] leading-tight hover:bg-zinc-700 sm:text-xs"
        >
          Ain&apos;t No Love 型
        </button>
        <button
          type="button"
          onClick={() => applyPreset(PRESET_SIMPLE)}
          className="min-h-9 rounded bg-zinc-800 px-2 py-1 text-[11px] leading-tight hover:bg-zinc-700 sm:text-xs"
        >
          シンプル
        </button>
        <button
          type="button"
          onClick={() =>
            applyPreset(defaultStructureForArtist(artistSlug))
          }
          className="min-h-9 rounded bg-zinc-800 px-2 py-1 text-[11px] leading-tight hover:bg-zinc-700 sm:text-xs"
        >
          アーティスト標準
        </button>
      </div>

      <div className="space-y-2">
        {sections.map((sec, i) => (
          <div
            key={sec.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2"
          >
            <span className="w-5 text-xs text-zinc-600">{i + 1}</span>
            <select
              value={sec.type}
              onChange={(e) =>
                updateSection(sec.id, { type: e.target.value as SectionType })
              }
              className="min-h-10 min-w-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-base sm:text-sm"
            >
              {SECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={32}
                value={sec.bars}
                onChange={(e) =>
                  updateSection(sec.id, {
                    bars: Math.min(32, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
                className="min-h-10 w-12 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-center text-base sm:w-16 sm:px-2 sm:text-sm"
              />
              <span className="text-xs text-zinc-500">小節</span>
            </div>
            <button
              type="button"
              onClick={() => removeSection(sec.id)}
              disabled={sections.length <= 1}
              className="min-h-10 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400 disabled:opacity-30"
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="min-h-11 w-full rounded border border-dashed border-zinc-700 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
      >
        + パートを追加
      </button>

      <p className="text-xs text-zinc-600">
        例: Intro 4 → Verse 16 → Hook 8 → Verse 16 → Hook 16 → Outro 4
      </p>
    </div>
  );
}
