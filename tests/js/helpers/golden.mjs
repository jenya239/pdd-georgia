import { readFileSync } from "node:fs";

export function readOracle(path) {
  return readFileSync(path, "utf8");
}
