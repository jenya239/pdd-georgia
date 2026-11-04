const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", э: "ee", ю: "yu", я: "ya",
};
const SUP: Record<string, string> = { "¹": "1", "²": "2", "³": "3", "⁴": "4" };
const ANNEX: Record<string, string> = { "1": "sign", "2": "mark" };

function num(value: string): string {
  let out = value.replaceAll("^", "_");
  for (const [mark, digit] of Object.entries(SUP)) out = out.replaceAll(mark, `_${digit}`);
  return out;
}

export function slug(normId: string): string {
  if (normId.startsWith("A")) {
    const colon = normId.indexOf(":");
    const annex = normId.slice(1, colon);
    const item = normId.slice(colon + 1);
    const head = ANNEX[annex];
    const note = item.match(/^(\d+)\.прим(\d*)((?:\.[а-я])*)$/);
    if (note) {
      const letters = note[3].split(".").filter(Boolean).map((letter) => `-${TRANSLIT[letter]}`).join("");
      return `${head}-${note[1]}-notes${note[2]}${letters}`;
    }
    return `${head}-${item}`;
  }
  const [art, ...rest] = normId.split(".");
  let out = `st${num(art)}`;
  if (rest.length) {
    out += `-p${num(rest[0])}`;
    out += rest.slice(1).map((letter) => `-${TRANSLIT[letter]}`).join("");
  }
  return out;
}
