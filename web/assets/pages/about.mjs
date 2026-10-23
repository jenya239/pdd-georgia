/** Page script: about.html. */
import { loadTickets } from "../app/data.mjs";
import { $ } from "../app/dom.mjs";
import { header } from "../app/layout.mjs";
header("about"); loadTickets().then(D => $("#nq").textContent = D.tickets.filter(t => t.law.length).length);
