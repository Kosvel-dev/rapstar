"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArtistProfile } from "@/lib/artist/types";
import type { LyricAnalysis } from "@/lib/analysis/types";
import type { DeliveryLineGuide } from "@/lib/analysis/deliveryGuide";
import type { RhymeGroup, RhymeSummary } from "@/lib/analysis/rhymeGroups";
import { PracticePanel, LyricsWithGuide } from "@/components/PracticePanel";
import { LyricsReadingView } from "@/components/LyricsReadingView";
import { SongStructureEditor } from "@/components/SongStructureEditor";
import type { AnnotatedLyricLine } from "@/lib/reading/annotateLyrics";
import { englishMixLabel, formatVowelTail } from "@/lib/ui/labels";
import {
  defaultStructureForArtist,
  THEME_PRESETS,
  type SongSectionConfig,
} from "@/lib/llm/songStructure";
import { MAIN_THEME_CATEGORIES } from "@/lib/llm/lyricCraftGuide";
import {
  DEFAULT_LEARNING_MODE,
  LEARNING_MODES,
  type LearningModeId,
} from "@/lib/llm/learningModes";
import type { RhymeCoverageMetrics } from "@/lib/llm/refineRhymes";

type ArtistListItem = {
  slug: string;
  name: string;
  songCount: number;
};

type Tab = "profile" | "analyze" | "write" | "practice";

const DEFAULT_BPM: Record<string, number> = {
  "masato-hayashi": 105,
  "pxrge-trxxxper": 140,
  "sh1t": 140,
  "son-si": 115,
  "verry-smol": 110,
  "kohjiya": 120,
  lex: 135,
  "yellow-bucks": 130,
  "bad-hop": 125,
};

export default function HomePage() {
  const [artists, setArtists] = useState<ArtistListItem[]>([]);
  const [slug, setSlug] = useState("masato-hayashi");
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [lyrics, setLyrics] = useState("");
  const [bpm, setBpm] = useState(110);
  const [analysis, setAnalysis] = useState<LyricAnalysis | null>(null);
  const [rhymeGroups, setRhymeGroups] = useState<RhymeGroup[]>([]);
  const [rhymeSummary, setRhymeSummary] = useState<RhymeSummary | null>(null);
  const [delivery, setDelivery] = useState<DeliveryLineGuide[]>([]);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  const [mainTheme, setMainTheme] = useState("成功");
  const [subTheme, setSubTheme] = useState("成り上がりとアンチへの返し");
  const [bars, setBars] = useState<4 | 8 | 16>(8);
  const [generateFormat, setGenerateFormat] = useState<"bars" | "full">("full");
  const [songSections, setSongSections] = useState<SongSectionConfig[]>(() =>
    defaultStructureForArtist("masato-hayashi"),
  );
  const [generated, setGenerated] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [strongRhyme, setStrongRhyme] = useState(true);
  const [learningMode, setLearningMode] =
    useState<LearningModeId>(DEFAULT_LEARNING_MODE);
  const [generatedRhymeCoverage, setGeneratedRhymeCoverage] = useState<
    number | null
  >(null);
  const [generatedRhymeMetrics, setGeneratedRhymeMetrics] =
    useState<RhymeCoverageMetrics | null>(null);
  const [rhymeRefined, setRhymeRefined] = useState(false);
  const [repetitionReduced, setRepetitionReduced] = useState(false);
  const [annotatedLines, setAnnotatedLines] = useState<AnnotatedLyricLine[]>([]);
  const [lyricsWithReading, setLyricsWithReading] = useState("");
  const [showReadingView, setShowReadingView] = useState(true);

  const [rhymeQuery, setRhymeQuery] = useState("フロー");
  const [rhymes, setRhymes] = useState<
    {
      word: string;
      reading?: string;
      tail: string;
      vowelKey: string;
      syllables: number;
      matchRate: number;
      strength: number;
    }[]
  >([]);
  const [rhymeTail, setRhymeTail] = useState("");

  useEffect(() => {
    fetch("/api/artists")
      .then((r) => r.json())
      .then((d) => setArtists(d.artists ?? []))
      .catch(() => setArtists([]));
  }, []);

  const loadProfile = useCallback(async (artistSlug: string) => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/artists/${artistSlug}/profile`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "プロファイル取得に失敗");
      setProfile(data.profile);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "エラー");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    const timeoutId = window.setTimeout(() => void loadProfile(slug), 0);
    return () => window.clearTimeout(timeoutId);
  }, [slug, loadProfile]);

  function changeArtist(nextSlug: string) {
    setSlug(nextSlug);
    if (DEFAULT_BPM[nextSlug]) setBpm(DEFAULT_BPM[nextSlug]);
    setSongSections(defaultStructureForArtist(nextSlug));
  }

  async function runAnalyze() {
    setAnalyzeLoading(true);
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
      setAnalyzeLoading(false);
    }
  }

  async function runGenerate() {
    setGenerateLoading(true);
    setGenerateError("");
    setGenerated("");
    setAnnotatedLines([]);
    setLyricsWithReading("");
    setGeneratedRhymeCoverage(null);
    setGeneratedRhymeMetrics(null);
    setRhymeRefined(false);
    setRepetitionReduced(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          mainTheme,
          subTheme,
          bpm,
          bars,
          format: generateFormat,
          sections: generateFormat === "full" ? songSections : undefined,
          strongRhyme,
          learningMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      setGenerated(data.lyrics);
      setLyrics(data.lyrics);
      setAnnotatedLines(data.annotatedLines ?? []);
      setLyricsWithReading(data.lyricsWithReading ?? "");
      setGeneratedRhymeCoverage(data.rhymeCoverage ?? null);
      setGeneratedRhymeMetrics(data.rhymeMetrics ?? null);
      setRhymeRefined(Boolean(data.rhymeRefined));
      setRepetitionReduced(Boolean(data.repetitionReduced));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "エラー");
    } finally {
      setGenerateLoading(false);
    }
  }

  async function runRhymes() {
    const res = await fetch(`/api/rhymes?q=${encodeURIComponent(rhymeQuery)}`);
    const data = await res.json();
    setRhymes(data.rhymes ?? []);
    setRhymeTail(data.queryTail ?? "");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">
              ラップスター
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
              アーティスト解析 & リリック制作
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
              歌詞から韻・フロー・歌い方を分析し、統計的特徴を使って歌詞を生成。ビートに乗って練習できます
            </p>
          </div>
          <select
            value={slug}
            onChange={(e) => changeArtist(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:w-auto sm:text-sm"
          >
            {artists.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name} ({a.songCount}曲)
              </option>
            ))}
            {artists.length === 0 && (
              <option value="masato-hayashi">Masato Hayashi</option>
            )}
          </select>
        </div>
      </header>

      <nav className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pt-3 pb-1 sm:px-6 sm:pt-4">
        {(
          [
            ["profile", "プロファイル"],
            ["analyze", "韻・フロー解析"],
            ["write", "リリック生成"],
            ["practice", "ビート乗り練習"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm ${
              tab === id
                ? "bg-amber-500 text-black font-medium"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {tab === "profile" && (
          <section className="space-y-6">
            {profileLoading && (
              <p className="text-zinc-400">コーパスを解析中…（初回は30秒ほど）</p>
            )}
            {profileError && <p className="text-red-400">{profileError}</p>}
            {profile && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  <StatCard label="曲数" value={String(profile.songCount)} />
                  <StatCard
                    label="平均モーラ/行"
                    value={String(profile.flow.averageMorasPerLine)}
                  />
                  <StatCard
                    label="フロー均一性"
                    value={`${profile.flow.uniformityScore}/100`}
                  />
                  <StatCard
                    label="行末韻スコア"
                    value={`${profile.rhyme.averageEndRhymeScore}/100`}
                  />
                  <StatCard
                    label="内部韻スコア"
                    value={`${profile.rhyme.averageInternalRhymeScore}/100`}
                  />
                  <StatCard
                    label="英語の混ぜ具合"
                    value={englishMixLabel(profile.delivery.englishMixLevel)}
                  />
                </div>

                <Panel title="歌い方・リリックの特徴">
                  <p className="text-zinc-300">{profile.delivery.styleSummary}</p>
                  <ul className="mt-3 list-disc pl-5 text-sm text-zinc-400">
                    {profile.delivery.traits.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="BPM別フロー（音に乗る目安）">
                  <div className="grid gap-2 md:grid-cols-2">
                    {profile.flow.flowStyles.map((f) => (
                      <div
                        key={f.bpmRange}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
                      >
                        <p className="font-medium text-amber-300">
                          BPM {f.bpmRange} — {f.label}
                        </p>
                        <p className="text-zinc-400">
                          目標 {f.targetMorasPerBar} モーラ/小節
                        </p>
                        <p className="mt-1 text-zinc-500">{f.description}</p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="よく使う語彙">
                  <div className="flex flex-wrap gap-2">
                    {profile.vocabulary.topWords.slice(0, 20).map((w) => (
                      <span
                        key={w.word}
                        className="rounded-full bg-zinc-800 px-3 py-1 text-sm"
                      >
                        {w.word}
                        <span className="ml-1 text-zinc-500">×{w.count}</span>
                      </span>
                    ))}
                  </div>
                </Panel>

                <Panel title="よく踏む韻尾（行末の母音）">
                  <div className="flex flex-wrap gap-2">
                    {profile.rhyme.commonEndVowelTails.map((v) => (
                      <span
                        key={v.tail}
                        className="rounded bg-zinc-800 px-2 py-1 text-sm"
                        title={v.tail}
                      >
                        {formatVowelTail(v.tail)} ×{v.count}
                      </span>
                    ))}
                  </div>
                </Panel>
              </>
            )}
          </section>
        )}

        {tab === "analyze" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Panel title="歌詞を入力">
              <label className="mb-2 block text-sm text-zinc-400">
                テンポ（BPM）: {bpm}
              </label>
              <input
                type="range"
                min={70}
                max={160}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="mb-4 w-full"
              />
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={14}
                placeholder="解析したい歌詞を貼り付け…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-base sm:text-sm"
              />
              <button
                type="button"
                onClick={runAnalyze}
                disabled={analyzeLoading || !lyrics.trim()}
                className="mt-3 min-h-11 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50 sm:w-auto"
              >
                {analyzeLoading ? "解析中…" : "韻・フローを解析"}
              </button>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={rhymeQuery}
                  onChange={(e) => setRhymeQuery(e.target.value)}
                  placeholder="韻を踏みたい語（例: フロー）"
                  className="min-h-11 flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
                />
                <button
                  type="button"
                  onClick={runRhymes}
                  className="min-h-11 rounded bg-zinc-800 px-3 py-2 text-sm"
                >
                  韻候補を探す
                </button>
              </div>
              {rhymes.length > 0 && (
                <div className="mt-2 text-sm text-zinc-400">
                  <p className="text-xs text-zinc-500">
                    「{rhymeQuery}」と踏める3〜6音節の母音韻（{formatVowelTail(rhymeTail)}）:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rhymes.map((r) => (
                      <span
                        key={`${r.word}-${r.reading ?? ""}`}
                        className="max-w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
                      >
                        <span className="break-all text-zinc-200">
                          {r.word}
                          {r.reading ? `（${r.reading}）` : ""}
                        </span>
                        <span className="ml-1 whitespace-nowrap text-zinc-500">
                          {r.vowelKey} · {r.syllables}音 · {r.matchRate}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="解析結果">
              {!analysis && (
                <p className="text-sm text-zinc-500">左側に歌詞を入力して解析</p>
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
        )}

        {tab === "write" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Panel title="生成条件">
              <label className="mb-1 block text-sm text-zinc-400">
                大テーマ（主軸）
              </label>
              <select
                value={mainTheme}
                onChange={(e) => setMainTheme(e.target.value)}
                className="mb-3 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
              >
                {MAIN_THEME_CATEGORIES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-sm text-zinc-400">
                小テーマ（人物・場所・具体状況）
              </label>
              {THEME_PRESETS[slug] && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {THEME_PRESETS[slug].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setMainTheme(p.mainTheme);
                        setSubTheme(p.subTheme);
                      }}
                      className="min-h-9 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <input
                value={subTheme}
                onChange={(e) => setSubTheme(e.target.value)}
                placeholder="例: Gangに愛はない。仲間に見せたい drama"
                className="mb-4 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
              />
              <label className="mb-1 block text-sm text-zinc-400">
                テンポ（BPM）: {bpm}
              </label>
              <input
                type="range"
                min={70}
                max={160}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="mb-4 w-full"
              />
              <label className="mb-1 block text-sm text-zinc-400">生成モード</label>
              <select
                value={generateFormat}
                onChange={(e) =>
                  setGenerateFormat(e.target.value as "bars" | "full")
                }
                className="mb-4 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
              >
                <option value="full">曲全体（Intro / Verse / Hook…）</option>
                <option value="bars">一部だけ（4 / 8 / 16 小節）</option>
              </select>
              <label className="mb-1 block text-sm text-zinc-400">
                韻の学習モード
              </label>
              <select
                value={learningMode}
                onChange={(e) => setLearningMode(e.target.value as LearningModeId)}
                className="mb-1 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
              >
                {LEARNING_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <p className="mb-4 text-xs text-zinc-500">
                {LEARNING_MODES.find((mode) => mode.id === learningMode)?.description}
              </p>
              {generateFormat === "bars" ? (
                <>
                  <label className="mb-1 block text-sm text-zinc-400">行数</label>
                  <select
                    value={bars}
                    onChange={(e) =>
                      setBars(Number(e.target.value) as 4 | 8 | 16)
                    }
                    className="mb-4 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base sm:text-sm"
                  >
                    <option value={4}>4小節（約4行）</option>
                    <option value={8}>8小節（約8行）</option>
                    <option value={16}>16小節（約16行）</option>
                  </select>
                </>
              ) : (
                <SongStructureEditor
                  sections={songSections}
                  onChange={setSongSections}
                  artistSlug={slug}
                />
              )}
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={strongRhyme}
                  onChange={(e) => setStrongRhyme(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                韻を強めに生成（内部韻 + 4小節チェーン + 自動修正）
              </label>
              <button
                type="button"
                onClick={runGenerate}
                disabled={generateLoading}
                className="min-h-12 w-full rounded-lg bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-50 sm:w-auto"
              >
                {generateLoading
                  ? generateFormat === "full"
                    ? "曲全体を生成中…（パートごとに数分かかります）"
                    : strongRhyme
                      ? "韻を踏みながら生成中…"
                      : "生成中…"
                  : generateFormat === "full"
                    ? "曲全体を生成"
                    : `${profile?.name ?? "プロファイル"}統計で生成`}
              </button>
              {generateError && (
                <p className="mt-3 text-sm text-red-400">{generateError}</p>
              )}
              <p className="mt-3 text-xs text-zinc-500">
                要: .env に DEEPSEEK_API_KEY。声質そのものは歌詞テキストから推定します。
              </p>
            </Panel>
            <Panel title="生成結果">
              {generatedRhymeCoverage !== null && (
                <p className="mb-3 text-sm text-amber-300">
                  総合韻密度: {generatedRhymeCoverage}/100
                  {rhymeRefined && "（韻が弱かったので自動で行末を修正しました）"}
                  {repetitionReduced && "（同じ語句が多かったので言い換えました）"}
                  {generatedRhymeCoverage >= 55 && !rhymeRefined && " — 韻がしっかり取れています"}
                </p>
              )}
              {generatedRhymeMetrics && (
                <div className="mb-3 grid grid-cols-2 gap-1 text-xs text-zinc-400">
                  <span>行末韻 {generatedRhymeMetrics.endRhymeCoverage}</span>
                  <span>内部韻 {generatedRhymeMetrics.internalRhymeCoverage}</span>
                  <span>マルチシラブル {generatedRhymeMetrics.multisyllableCoverage}</span>
                  <span>4小節チェーン {generatedRhymeMetrics.chainCoverage}</span>
                </div>
              )}
              {generated ? (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowReadingView(true)}
                      className={`min-h-9 rounded px-3 py-1 text-xs ${showReadingView ? "bg-sky-900/60 text-sky-200" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      読み仮名付き
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReadingView(false)}
                      className={`min-h-9 rounded px-3 py-1 text-xs ${!showReadingView ? "bg-zinc-700 text-zinc-200" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      歌詞のみ
                    </button>
                    {lyricsWithReading && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(lyricsWithReading)}
                        className="col-span-2 min-h-9 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        読み仮名付きでコピー
                      </button>
                    )}
                  </div>
                  {showReadingView && annotatedLines.length > 0 ? (
                    <LyricsReadingView lines={annotatedLines} />
                  ) : (
                    <pre className="whitespace-pre-wrap break-all text-sm leading-relaxed text-zinc-200">
                      {generated}
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-sm text-zinc-500">ここに生成された歌詞が表示されます</p>
              )}
              {generated && (
                <button
                  type="button"
                  onClick={() => setTab("practice")}
                  className="mt-4 min-h-11 w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 sm:w-auto"
                >
                  ビート乗り練習へ →
                </button>
              )}
            </Panel>
          </section>
        )}

        {tab === "practice" && (
          <PracticePanel
            slug={slug}
            profile={profile}
            bpm={bpm}
            setBpm={setBpm}
            lyrics={lyrics || generated}
            setLyrics={setLyrics}
          />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold sm:text-2xl">{value}</p>
    </div>
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
