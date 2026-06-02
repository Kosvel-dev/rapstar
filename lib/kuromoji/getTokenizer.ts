import path from "node:path";
import fs from "node:fs";
import kuromoji from "kuromoji";
import type { IpadicFeatures, Tokenizer } from "kuromoji";
import { isKuromojiEnabled } from "./isEnabled";

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;
let initFailed = false;

function resolveDictPath(): string {
  const bundled = path.join(process.cwd(), "data", "kuromoji-dict");
  if (fs.existsSync(path.join(bundled, "base.dat.gz"))) {
    return bundled;
  }
  return path.join(process.cwd(), "node_modules", "kuromoji", "dict");
}

/** kuromoji トークナイザ（プロセス内シングルトン・初回のみ辞書ロード） */
export function getKuromojiTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (!isKuromojiEnabled()) {
    return Promise.reject(new Error("kuromoji is disabled"));
  }

  if (initFailed) {
    return Promise.reject(new Error("kuromoji init previously failed"));
  }

  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: resolveDictPath() }).build((err, tokenizer) => {
        if (err || !tokenizer) {
          initFailed = true;
          tokenizerPromise = null;
          reject(err ?? new Error("kuromoji build failed"));
          return;
        }
        resolve(tokenizer);
      });
    });
  }

  return tokenizerPromise;
}

/** 初期化失敗フラグをリセット（テスト用） */
export function resetKuromojiTokenizerForTests(): void {
  tokenizerPromise = null;
  initFailed = false;
}
