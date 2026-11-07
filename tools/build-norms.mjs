import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLawEn } from "../packages/build/law-ka-en.ts";
import { parseAnnex, parseLaw } from "../packages/build/law-ru.ts";
import { generateNorms, parseAnnexNotes } from "../packages/build/norms.ts";
import { dumps } from "../packages/build/pyjson.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

export function normsJson() {
  const ruAnnex = readText("data/sources/annexes_ru_matsne_pub36.txt");
  const kaAnnex = readText("data/sources/annexes_ka_matsne_pub36_2026.txt");
  return dumps(generateNorms({
    ru: parseLaw(readText("data/sources/law_ru_matsne_pub36_2026-06-25.txt")),
    ka: parseLaw(readText("data/sources/law_ka_matsne_pub36_2026-06-25.txt")),
    en: parseLawEn(readText("data/sources/law_en_official_matsne_2019-06-28.txt")),
    annexRu: parseAnnex(ruAnnex),
    annexKa: parseAnnex(kaAnnex),
    notesRu: parseAnnexNotes(ruAnnex),
    notesKa: parseAnnexNotes(kaAnnex),
  }));
}
