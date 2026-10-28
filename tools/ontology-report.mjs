import { assignmentText, reportText } from "./load-ontology.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = process.argv[2] === "--assignment" ? assignmentText(repo) : reportText(repo);
process.stdout.write(text);
