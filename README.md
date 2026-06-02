# ラップスター (Rapstar)

日本語ラップ向けの歌詞解析・韻チェック・文体生成・ビート練習ツール。

## 構成

- `web/` — Next.js アプリ（本番デプロイ対象）
- `data/` — Genius から取得した歌詞コーパス
- `scripts/` — 歌詞取得スクリプト（Python）

## ローカル開発

```powershell
# 環境変数（rapstar/.env）
cp .env.example .env
# GENIUS_ACCESS_TOKEN, DEEPSEEK_API_KEY を設定

# Web アプリ
cd web
npm install
npm run dev
```

http://localhost:3000

## 歌詞データの更新

```powershell
cd rapstar
uv run python scripts/fetch_genius_lyrics.py --preset masato-hayashi
uv run python scripts/fetch_genius_lyrics.py --preset pxrge-trxxxper
```

## Vercel 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 生成機能に必要 | DeepSeek API |
| `DEEPSEEK_BASE_URL` | 任意 | デフォルト `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 任意 | デフォルト `deepseek-v4-pro` |
| `GENIUS_ACCESS_TOKEN` | 任意 | 歌詞再取得時のみ |
| `YOUTUBE_API_KEY` | 任意 | ビート埋め込み |

## デプロイ

Vercel の **Root Directory** を `web` に設定してください。

GitHub 連携後、上記の環境変数を Vercel ダッシュボードで設定します。
