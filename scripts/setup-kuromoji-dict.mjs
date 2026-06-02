import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DICT_FILES = [
  "base.dat.gz",
  "cc.dat.gz",
  "check.dat.gz",
  "tid.dat.gz",
  "tid_map.dat.gz",
  "tid_pos.dat.gz",
  "unk.dat.gz",
  "unk_char.dat.gz",
  "unk_compat.dat.gz",
  "unk_invoke.dat.gz",
  "unk_map.dat.gz",
  "unk_pos.dat.gz",
];

const BASE_URL =
  "https://raw.githubusercontent.com/takuyaa/kuromoji.js/master/dict/";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dictDir = path.join(root, "data", "kuromoji-dict");

async function downloadDict() {
  fs.mkdirSync(dictDir, { recursive: true });

  for (const file of DICT_FILES) {
    const dest = path.join(dictDir, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const url = `${BASE_URL}${file}`;
    console.log(`download ${file}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  }

  console.log(`kuromoji dict ready at ${dictDir}`);
}

downloadDict().catch((err) => {
  console.error(err);
  process.exit(1);
});
