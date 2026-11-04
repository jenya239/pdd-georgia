import { readFileSync } from "node:fs";
import { normFiles } from "../packages/norm/pages.ts";

const model = JSON.parse(readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify(normFiles(model.backlinks)));
