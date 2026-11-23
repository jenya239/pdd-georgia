import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path, "utf8");
const lesson = id => read(`site/lessons/${id === "ep07" || id === "ep08" ? id + ".html" : id + "-plain.html"}`);
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const beforeTickets = id => lesson(id).split("<!--AFTER-TICKETS-->")[0];
const paragraphs = html => [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)].map(m => m[0]);
const expected = [
  { ep:"ep02", ticket:265, norm:"st31-p18", patterns:[/обочин/i,/затор/i,/не становятся|нельзя|не относятся/i] },
  { ep:"ep03", ticket:2, norm:"st25-p7", patterns:[/выезжает со стоянки/i,/пешеход/i,/нет зебры/i,/неверен/i] },
  { ep:"ep04", ticket:288, norm:"st34-p11", patterns:[/обгон/i,/пешеход/i,/запрещ/i,/неверн/i] },
  { ep:"ep04", ticket:418, norm:"st39-p2-a", patterns:[/переезд/i,/встречн/i,/запрещ/i,/открыт/i] },
  { ep:"ep06", ticket:75, norm:"st36-p2", patterns:[/отключ/i,/нерегулируем/i,/трамва/i,/ошибка|ловушк/i] },
  { ep:"ep07", ticket:357, norm:null, patterns:[/пяти минут/i,/посадк|груз/i,/русском переводе/i,/грузинск/i] },
];

test("selected high-safety tickets have a complete reading passage, not just a number", () => {
  for(const {ep,ticket,norm,patterns} of expected) {
    const html=beforeTickets(ep);
    const hit=paragraphs(html).filter(p => p.includes(`№${ticket}`));
    assert.equal(hit.length,1,`${ep} ticket #${ticket}: exactly one integrated paragraph`);
    const content=text(hit[0]);
    assert.ok(content.length >= 290,`${ep} #${ticket}: passage too brief to explain the trap`);
    for(const pattern of patterns) assert.match(content,pattern,`${ep} #${ticket}: missing decisive condition or rejected inference`);
    if(norm) assert.ok(hit[0].includes(`norm/${norm}.html`),`${ep} #${ticket} missing relevant statute`);
    const path=`content/breakdowns/${ticket}.json`;
    assert.ok(existsSync(path),`official ticket #${ticket}: curated explanation absent`);
    const breakdown=JSON.parse(read(path));
    assert.equal(breakdown.ticket,ticket);
    assert.ok(breakdown.steps.length >= 2 && Object.keys(breakdown.why_not ?? {}).length > 0,`ticket #${ticket}: source reasoning/distractors missing`);
  }
});

test("all eight lessons include their curated cases while honest gaps stay explicit", () => {
  const d=JSON.parse(read("content/plan/visual-editorial-review.json"));
  const o=JSON.parse(read("content/ontology/lessons.json"));
  const report=JSON.parse(read("content/ontology/generated/report.json"));
  assert.equal(o.length,8);
  assert.equal(o.reduce((n,e)=>n+e.introduces.length,0),73);
  assert.equal(report.stats.annotated_tickets,84);
  assert.equal(report.assignment.blocked,13);
  assert.equal(report.gaps.untaught_concepts.length,8);
  assert.equal(d.episodes.reduce((n,e)=>n+e.integratedTickets.length,0),25);
  for(const entry of d.episodes) {
    const html=beforeTickets(entry.id);
    for(const ticket of entry.integratedTickets) {
      assert.ok(html.includes(`№${ticket}`),`${entry.id} lists #${ticket} as integrated, but no contextual explanation found`);
      assert.ok(existsSync(`content/breakdowns/${ticket}.json`),`#${ticket} needs original ticket breakdown`);
    }
  }
  const narrative=read("docs/block-0-1-completeness-safety-audit.md");
  for(const phrase of ["13 заблокированных","8 ещё не преподаваемых","№794","№1262","25 репрезентативных"])
    assert.ok(narrative.includes(phrase),`must not conceal unresolved gap ${phrase}`);
});

test("safety guidance is integrated without inventing fine amounts", () => {
  const p={
    ep01:beforeTickets("ep01"),
    ep02:beforeTickets("ep02"),
    ep03:beforeTickets("ep03"),
    ep04:beforeTickets("ep04"),
    ep05:beforeTickets("ep05"),
    ep06:beforeTickets("ep06"),
    ep07:beforeTickets("ep07"),
    ep08:beforeTickets("ep08"),
  };
  assert.ok(p.ep01.includes("matsne.gov.ge/ka/document/view/28216"));
  assert.ok(p.ep02.includes("norm/st5-p15.html"),"carriageway defined in article 5(15), not road 5(12)");
  const carriageway=paragraphs(p.ep02).find(x=>x.includes("<em>проезжая часть</em> — элемент"));
  assert.ok(carriageway?.includes("st5-p15.html") && !carriageway.includes("st5-p12.html"));
  for(const [id,words] of [
    ["ep02",["обочине","пешеход"]],
    ["ep03",["нет зебры","закрыть обзор"]],
    ["ep04",["пешеход","обгон","рельс","перед"]],
    ["ep05",["нужно учитывать приближающихся","не создавать угрозу"]],
    ["ep06",["неработающий светофор","нерегулируемых"]],
    ["ep07",["не даёт ему права","пяти минут"]],
    ["ep08",["неожиданно изменить скорость","приоритет"]],
  ]) {
    for(const word of words) assert.ok(text(p[id]).includes(word),`${id}: missing practical safety connection ${word}`);
  }
  for(const {ep,ticket} of expected) {
    const hit=paragraphs(p[ep]).find(x=>x.includes(`№${ticket}`));
    assert.doesNotMatch(hit,/\b\d+\s*(?:лари|GEL)\b/i,`${ep} #${ticket}: fine amount needs case-specific legal verification`);
  }
});

test("ep04 railway scenarios teach transferable decisions, not memorized ticket answers", () => {
  const html=beforeTickets("ep04");
  const section=html.split('<h2 id="railway">')[1]?.split('<h2 id="town">')[0];
  assert.ok(section, "railway teaching section must exist");
  const prose=text(section);
  for(const pattern of [
    /брус поднят, но горит запрещающий сигнал/i,
    /сигнал разрешает движение, но шлагбаум ещё поднимается/i,
    /очередь сдвинулась и впереди появилось место/i,
    /это устраняет именно препятствие за путями/i,
    /остановиться не ближе пяти метров/i,
    /не менее десяти метров до ближайшего рельса/i,
    /№422/, /№418/,
  ]) assert.match(prose, pattern, "railway transfer condition missing");
  assert.ok(html.includes('norm/st39-p3.html'), "railway stop hierarchy must retain legal source");
});
