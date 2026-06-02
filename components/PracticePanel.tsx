"use client";

import { useEffect, useState } from "react";
import type { ArtistProfile } from "@/lib/artist/types";
import type { LyricAnalysis } from "@/lib/analysis/types";
import type { DeliveryLineGuide } from "@/lib/analysis/deliveryGuide";
import {
  INTENSITY_COLOR,
  INTENSITY_LABEL,
} from "@/lib/analysis/deliveryGuide";
import type { RhymeGroup, RhymeSummary } from "@/lib/analysis/rhymeGroups";
import { vowelTail } from "@/lib/analysis/kana";
import {
  deliveryLegendText,
  formatVowelTail,
  RHYME_HELP,
} from "@/lib/ui/labels";
import { shouldShowReadingForLine } from "@/lib/reading/showReading";

type BeatRec = {
  title: string;
  searchQuery: string;
  youtubeSearchUrl: string;
  suggestedBpm: number;
  reason: string;
  videoId?: string;
  embedUrl?: string;
};

const GROUP_COLORS = [
  "border-l-amber-400",
  "border-l-emerald-400",
  "border-l-sky-400",
  "border-l-pink-400",
  "border-l-violet-400",
  "border-l-orange-400",
];

const GROUP_HIGHLIGHT_COLORS = [
  "bg-amber-400/20 text-amber-200",
  "bg-emerald-400/20 text-emerald-200",
  "bg-sky-400/20 text-sky-200",
  "bg-pink-400/20 text-pink-200",
  "bg-violet-400/20 text-violet-200",
  "bg-orange-400/20 text-orange-200",
];

function lineGroupColor(index: number, groups: RhymeGroup[]): string {
  const gIdx = groups.findIndex((g) => g.lineIndices.includes(index));
  if (gIdx < 0) return "border-l-zinc-700";
  return GROUP_COLORS[gIdx % GROUP_COLORS.length];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedLine(text: string, lineIndex: number, groups: RhymeGroup[]) {
  const words = groups
    .flatMap((group, groupIndex) =>
      group.occurrences
        .filter((occurrence) => occurrence.lineIndex === lineIndex)
        .map((occurrence) => ({ word: occurrence.word, groupIndex })),
    )
    .filter((item) => item.word.length >= 2)
    .sort((a, b) => b.word.length - a.word.length);
  if (words.length === 0) return text;

  const groupByWord = new Map(words.map((item) => [item.word, item.groupIndex]));
  const pattern = new RegExp(
    `(${[...groupByWord.keys()].map(escapeRegExp).join("|")})`,
    "g",
  );

  return text.split(pattern).map((part, index) => {
    const groupIndex = groupByWord.get(part);
    if (groupIndex === undefined) return part;
    return (
      <mark
        key={`${part}-${index}`}
        className={`rounded px-0.5 ${GROUP_HIGHLIGHT_COLORS[groupIndex % GROUP_HIGHLIGHT_COLORS.length]}`}
      >
        {part}
      </mark>
    );
  });
}

function heatColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export function LyricsWithGuide({
  analysis,
  rhymeGroups,
  rhymeSummary,
  delivery,
}: {
  analysis: LyricAnalysis;
  rhymeGroups: RhymeGroup[];
  rhymeSummary: RhymeSummary;
  delivery: DeliveryLineGuide[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
        {deliveryLegendText()}
      </p>
      <div className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-sm">
        <p className="font-semibold text-emerald-300">
          総合韻密度: {analysis.density.overall}/100
        </p>
        <p className="font-medium text-amber-300">
          3音節以上の行末韻: {rhymeSummary.endRhymeCoverage}%（
          {rhymeSummary.linesWithEndRhyme}/{rhymeSummary.totalLines}行）
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-zinc-400 sm:text-xs">
          <span>行末韻 {analysis.density.endRhyme}</span>
          <span>内部韻 {analysis.density.internalRhyme}</span>
          <span>マルチシラブル {analysis.density.multisyllableRhyme}</span>
          <span>4小節チェーン {analysis.density.consecutiveRhyme}</span>
        </div>
        <p className="mt-1 text-zinc-400">{rhymeSummary.verdict}</p>
        <p className="mt-2 text-xs text-zinc-500">{RHYME_HELP}</p>
        {rhymeGroups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {rhymeGroups.slice(0, 6).map((g) => (
              <span
                key={g.id}
                className="max-w-full break-all rounded bg-zinc-800 px-2 py-0.5 text-[11px] sm:text-xs"
              >
                {g.vowelKey} · {g.syllables}音節 → 行
                {g.lineIndices.map((i) => i + 1).join("・")}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-[32rem] min-w-0 space-y-2 overflow-y-auto pr-0.5 sm:max-h-[28rem]">
        {analysis.lines.map((line) => {
          const guide = delivery.find((d) => d.index === line.index);
          const metrics = line.rhymeMetrics;
          return (
            <div
              key={line.index}
              className={`min-w-0 rounded border-l-4 p-2 text-sm ${lineGroupColor(line.index, rhymeGroups)} ${guide ? INTENSITY_COLOR[guide.intensity] : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">行{line.index + 1}</span>
                {guide && (
                  <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                    {INTENSITY_LABEL[guide.intensity]}
                  </span>
                )}
                <span className="break-all text-[11px] text-zinc-500 sm:text-xs">
                  {line.moras}モーラ · 韻「{line.endUnit}」
                  {line.endVowels
                    ? ` · 母音 ${formatVowelTail(vowelTail(line.endVowels, 2))}`
                    : ""}
                </span>
              </div>
              <p className="mt-1 break-words leading-relaxed">
                {highlightedLine(line.text, line.index, rhymeGroups)}
              </p>
              {metrics && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-x-3 text-[11px] text-zinc-400">
                    <span>韻密度 {metrics.density}%</span>
                    <span>内部韻 {metrics.internalRhymeCount}組</span>
                    <span>母音一致 {metrics.vowelMatchRate}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-zinc-800">
                    <div
                      className={`h-full ${heatColor(metrics.density)}`}
                      style={{ width: `${metrics.density}%` }}
                    />
                  </div>
                </div>
              )}
              {line.reading && shouldShowReadingForLine(line.text, line.reading) && (
                <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-sky-400/90 sm:text-xs">
                  {line.reading}
                </p>
              )}
              {guide && (
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
                  {guide.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PracticePanel({
  slug,
  profile,
  bpm,
  setBpm,
  lyrics,
  setLyrics,
}: {
  slug: string;
  profile: ArtistProfile | null;
  bpm: number;
  setBpm: (n: number) => void;
  lyrics: string;
  setLyrics: (s: string) => void;
}) {
  const [beats, setBeats] = useState<BeatRec[]>([]);
  const [embedId, setEmbedId] = useState("");
  const [analysis, setAnalysis] = useState<LyricAnalysis | null>(null);
  const [rhymeGroups, setRhymeGroups] = useState<RhymeGroup[]>([]);
  const [rhymeSummary, setRhymeSummary] = useState<RhymeSummary | null>(null);
  const [delivery, setDelivery] = useState<DeliveryLineGuide[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/beats?slug=${slug}&bpm=${bpm}`)
      .then((r) => r.json())
      .then((d) => {
        setBeats(d.recommendations ?? []);
        const firstEmbed = (d.recommendations ?? []).find(
          (b: BeatRec) => b.videoId,
        );
        if (firstEmbed?.videoId) setEmbedId(firstEmbed.videoId);
      })
      .catch(() => setBeats([]));
  }, [slug, bpm]);

  async function analyze() {
    if (!lyrics.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, bpm }),
      });
      const data = await res.json();
      setAnalysis(data.analysis);
      setRhymeGroups(data.rhymeGroups ?? []);
      setRhymeSummary(data.rhymeSummary ?? null);
      setDelivery(data.delivery ?? []);
    } finally {
      setLoading(false);
    }
  }

  const embedSrc = embedId
    ? `https://www.youtube.com/embed/${embedId}?autoplay=0`
    : null;

  return (
    <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <div className="space-y-4">
        <Panel title="フリービート（YouTube）">
          <label className="mb-1 block text-sm text-zinc-400">
            テンポ（BPM）: {bpm}（{profile?.name ?? slug}向け）
          </label>
          <input
            type="range"
            min={70}
            max={160}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="mb-4 w-full"
          />
          <div className="space-y-2">
            {beats.slice(0, 4).map((b) => (
              <div
                key={b.searchQuery + b.title}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
              >
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-zinc-500">{b.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={b.youtubeSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-200 hover:bg-red-900"
                  >
                    YouTubeで探す
                  </a>
                  {b.videoId && (
                    <button
                      type="button"
                      onClick={() => setEmbedId(b.videoId!)}
                      className="min-h-9 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                    >
                      このビートで練習
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            .env に YOUTUBE_API_KEY を設定すると、ビートをここに直接埋め込めます
          </p>
          <label className="mt-3 block text-xs text-zinc-400">
            または YouTube の動画IDを直接入力
          </label>
          <input
            value={embedId}
            onChange={(e) => setEmbedId(e.target.value.trim())}
            placeholder="例: dQw4w9WgXcQ（URLの v= の後ろ）"
            className="mt-1 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-base sm:text-sm"
          />
        </Panel>

        {embedSrc && (
          <Panel title="ビート再生">
            <div className="aspect-video overflow-hidden rounded-lg">
              <iframe
                title="YouTube ビート"
                src={embedSrc}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Panel>
        )}

        <Panel title="練習する歌詞">
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={8}
            className="w-full rounded border border-zinc-700 bg-zinc-900 p-3 text-base sm:text-sm"
            placeholder="生成した歌詞 or 自分のラップを貼る"
          />
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !lyrics.trim()}
            className="mt-2 min-h-11 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50 sm:w-auto"
          >
            {loading ? "解析中…" : "韻 + 歌い方を解析"}
          </button>
        </Panel>
      </div>

      <Panel title="韻・歌い方ガイド">
        {!analysis && (
          <p className="text-sm text-zinc-500">
            歌詞を入力して「韻 + 歌い方を解析」を押してください。
            {RHYME_HELP}
          </p>
        )}
        {analysis && (
          <p className="mb-3 text-xs text-zinc-500">{deliveryLegendText()}</p>
        )}
        {analysis && rhymeSummary && (
          <LyricsWithGuide
            analysis={analysis}
            rhymeGroups={rhymeGroups}
            rhymeSummary={rhymeSummary}
            delivery={delivery}
          />
        )}
      </Panel>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold sm:text-lg">{title}</h2>
      {children}
    </div>
  );
}
