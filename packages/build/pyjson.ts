export type Json = null | boolean | number | string | Json[] | Map<string, Json>;

export type DumpOptions = {
  indent?: number;
  sortKeys?: boolean;
  ascii?: boolean;
  newline?: boolean;
};

export function parse(text: string): Json {
  let i = 0;

  function skip(): void {
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
      i += 1;
    }
  }

  function fail(what: string): never {
    throw new Error(`${what} at ${i}`);
  }

  function parseValue(): Json {
    skip();
    const c = text[i];
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === '"') return parseString();
    if (c === "t") {
      i += 4;
      return true;
    }
    if (c === "f") {
      i += 5;
      return false;
    }
    if (c === "n") {
      i += 4;
      return null;
    }
    return parseNumber();
  }

  function parseObject(): Map<string, Json> {
    const map = new Map<string, Json>();
    i += 1;
    skip();
    if (text[i] === "}") {
      i += 1;
      return map;
    }
    while (i < text.length) {
      skip();
      const key = parseString();
      skip();
      if (text[i] !== ":") fail("colon");
      i += 1;
      map.set(key, parseValue());
      skip();
      if (text[i] === "}") {
        i += 1;
        return map;
      }
      if (text[i] !== ",") fail("comma");
      i += 1;
    }
    fail("object");
  }

  function parseArray(): Json[] {
    const items: Json[] = [];
    i += 1;
    skip();
    if (text[i] === "]") {
      i += 1;
      return items;
    }
    while (i < text.length) {
      items.push(parseValue());
      skip();
      if (text[i] === "]") {
        i += 1;
        return items;
      }
      if (text[i] !== ",") fail("comma");
      i += 1;
    }
    fail("array");
  }

  function parseString(): string {
    if (text[i] !== '"') fail("string");
    i += 1;
    let out = "";
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i += 1;
        return out;
      }
      if (c === "\\") {
        i += 1;
        const escape = text[i];
        i += 1;
        if (escape === '"' || escape === "\\" || escape === "/") out += escape;
        else if (escape === "b") out += "\b";
        else if (escape === "f") out += "\f";
        else if (escape === "n") out += "\n";
        else if (escape === "r") out += "\r";
        else if (escape === "t") out += "\t";
        else if (escape === "u") {
          out += String.fromCharCode(Number.parseInt(text.slice(i, i + 4), 16));
          i += 4;
        } else fail("escape");
        continue;
      }
      out += c;
      i += 1;
    }
    fail("string");
  }

  function parseNumber(): number {
    const start = i;
    if (text[i] === "-") i += 1;
    if (text[i] === "0") i += 1;
    else if (text[i] >= "1" && text[i] <= "9") {
      while (text[i] >= "0" && text[i] <= "9") i += 1;
    } else fail("number");
    if (text[i] === ".") {
      i += 1;
      if (text[i] < "0" || text[i] > "9") fail("number");
      while (text[i] >= "0" && text[i] <= "9") i += 1;
    }
    if (text[i] === "e" || text[i] === "E") {
      i += 1;
      if (text[i] === "+" || text[i] === "-") i += 1;
      if (text[i] < "0" || text[i] > "9") fail("number");
      while (text[i] >= "0" && text[i] <= "9") i += 1;
    }
    return Number(text.slice(start, i));
  }

  const value = parseValue();
  skip();
  if (i !== text.length) fail("end");
  return value;
}

function compareCodePoints(left: string, right: string): number {
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const a = left.codePointAt(i) ?? 0;
    const b = right.codePointAt(j) ?? 0;
    if (a !== b) return a - b;
    i += a > 0xffff ? 2 : 1;
    j += b > 0xffff ? 2 : 1;
  }
  return left.length - right.length;
}

function quote(value: string, ascii: boolean): string {
  const quoted = JSON.stringify(value);
  if (!ascii) return quoted;
  let out = "";
  for (let i = 0; i < quoted.length; i += 1) {
    const code = quoted.charCodeAt(i);
    out += code > 0x7f ? `\\u${code.toString(16).padStart(4, "0")}` : quoted[i];
  }
  return out;
}

function write(value: Json, options: DumpOptions, depth: number, parts: string[]): void {
  if (value === null) {
    parts.push("null");
    return;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    parts.push(JSON.stringify(value));
    return;
  }
  if (typeof value === "string") {
    parts.push(quote(value, options.ascii === true));
    return;
  }
  const gap = options.indent == null ? null : " ".repeat(options.indent);
  if (Array.isArray(value)) {
    writeList(value, gap, options, depth, parts);
    return;
  }
  writeMap(value, gap, options, depth, parts);
}

function writeList(items: Json[], gap: string | null, options: DumpOptions, depth: number, parts: string[]): void {
  if (items.length === 0) {
    parts.push("[]");
    return;
  }
  if (gap == null) {
    parts.push("[");
    for (let i = 0; i < items.length; i += 1) {
      if (i) parts.push(",");
      write(items[i], options, depth + 1, parts);
    }
    parts.push("]");
    return;
  }
  const pad = gap.repeat(depth + 1);
  parts.push("[\n");
  for (let i = 0; i < items.length; i += 1) {
    if (i) parts.push(",\n");
    parts.push(pad);
    write(items[i], options, depth + 1, parts);
  }
  parts.push("\n", gap.repeat(depth), "]");
}

function writeMap(map: Map<string, Json>, gap: string | null, options: DumpOptions, depth: number, parts: string[]): void {
  const entries = [...map];
  if (options.sortKeys) entries.sort((left, right) => compareCodePoints(left[0], right[0]));
  if (entries.length === 0) {
    parts.push("{}");
    return;
  }
  const ascii = options.ascii === true;
  if (gap == null) {
    parts.push("{");
    for (let i = 0; i < entries.length; i += 1) {
      if (i) parts.push(",");
      parts.push(quote(entries[i][0], ascii), ":");
      write(entries[i][1], options, depth + 1, parts);
    }
    parts.push("}");
    return;
  }
  const pad = gap.repeat(depth + 1);
  parts.push("{\n");
  for (let i = 0; i < entries.length; i += 1) {
    if (i) parts.push(",\n");
    parts.push(pad, quote(entries[i][0], ascii), ": ");
    write(entries[i][1], options, depth + 1, parts);
  }
  parts.push("\n", gap.repeat(depth), "}");
}

export function dumps(value: Json, options: DumpOptions = {}): string {
  const parts: string[] = [];
  write(value, options, 0, parts);
  if (options.newline) parts.push("\n");
  return parts.join("");
}
