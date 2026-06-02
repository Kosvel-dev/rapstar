# ラップスター (Rapstar)

日本語ラップ向けの歌詞解析・韻チェック・文体生成・ビート練習ツール。

## 構成

- `app/`, `components/`, `lib/` — Next.js アプリ
- `data/` — Genius から取得した歌詞コーパス
- `scripts/` — 歌詞取得スクリプト（Python）

## ローカル開発

```powershell
cp .env.example .env
# GENIUS_ACCESS_TOKEN, DEEPSEEK_API_KEY を設定

npm install
npm run dev
```

http://localhost:3000

## 歌詞データの更新

登録アーティスト（Genius から取得）:

| slug | アーティスト | 備考 |
|------|-------------|------|
| `masato-hayashi` | Masato Hayashi | RAPSTAR 2025 ファイナリスト |
| `pxrge-trxxxper` | Pxrge Trxxxper | RAPSTAR 2025 優勝 |
| `sh1t` | sh1t | RAPSTAR 2025 ファイナリスト |
| `son-si` | Sonsi | RAPSTAR 2025 ファイナリスト |
| `verry-smol` | VERRY SMoL | RAPSTAR 2025 ファイナリスト |
| `kohjiya` | Kohjiya | RAPSTAR 2024 優勝 |
| `lex` | LEX | 人気ラッパー / RAPSTAR 審査員 |
| `yellow-bucks` | ¥ellow Bucks | 人気ラッパー |
| `bad-hop` | BAD HOP | 横浜クルー |

```powershell
# 1アーティスト
uv run python scripts/fetch_genius_lyrics.py --preset lex

# 新規追加分をまとめて取得
uv run python scripts/fetch_genius_lyrics.py --all-new
```

## デプロイ

- **GitHub**: https://github.com/Kosvel-dev/rapstar
- **本番 URL**: https://web-three-blush-26.vercel.app

Next.js はリポジトリ直下にあるので、**Root Directory の設定は不要**です。  
GitHub に push すると Vercel が自動デプロイします。

環境変数は Vercel ダッシュボード → **rapstar_lyric** → **Settings → Environment Variables** で設定します。

| 変数 | 必須 | 説明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 生成機能に必要 | DeepSeek API |
| `DEEPSEEK_BASE_URL` | 任意 | デフォルト `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 任意 | デフォルト `deepseek-v4-pro` |
| `GENIUS_ACCESS_TOKEN` | 任意 | 歌詞再取得時のみ |
| `YOUTUBE_API_KEY` | 任意 | ビート埋め込み |
