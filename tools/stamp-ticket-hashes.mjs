import { readFileSync } from "node:fs";
import { ticketHash } from "../packages/domain/ticket-hash.ts";

const tickets = JSON.parse(readFileSync(0, "utf8"));
if (!Array.isArray(tickets)) {
  process.stderr.write("expected a ticket array\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify(tickets.map(ticketHash)));
