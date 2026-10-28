import { reportText } from "./load-ontology.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.stdout.write(reportText(repo));
