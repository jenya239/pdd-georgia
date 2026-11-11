import { createHash } from "node:crypto";

const PER_OPTION = ["premature", "new-decision", "swap-breaks", "method"];

export function presentPair(item, rubric) {
  const byId = new Map(rubric.questions.map((question) => [question.id, question]));
  const laterFirst = createHash("sha256").update(item.id).digest()[0] % 2 === 1;
  const texts = laterFirst ? [item.later, item.earlier] : [item.earlier, item.later];
  const questions = [];
  for (const id of PER_OPTION) {
    const question = byId.get(id);
    for (const target of ["1", "2"]) {
      questions.push({ id, kind: question.kind, target, text: question.text });
    }
  }
  if (item.quote) {
    const question = byId.get("extra-condition");
    for (const target of ["1", "2"]) {
      questions.push({ id: question.id, kind: question.kind, target, text: question.text });
    }
  }
  const follow = byId.get("follow");
  questions.push({ id: follow.id, kind: follow.kind, text: follow.text, options: follow.options });
  return {
    input: {
      context: item.context,
      quote: item.quote,
      options: [
        { n: "1", text: texts[0] },
        { n: "2", text: texts[1] },
      ],
    },
    questions,
  };
}
