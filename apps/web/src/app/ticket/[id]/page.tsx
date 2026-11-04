import { notFound } from "next/navigation";
import { parseTicketId } from "@course/ticket-face.ts";
import { loadAttemptCount } from "../../../server/load-attempts.ts";
import { loadTicketFace } from "../../../server/load-ticket.ts";
import { TicketArticle } from "../../../ticket/ticket-article.tsx";

function learnerOf(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ learner?: string | string[] }>;
}) {
  const { id: raw } = await params;
  const id = parseTicketId(raw);
  if (id === null) notFound();
  const face = await loadTicketFace(id);
  if (face === null) notFound();
  const learnerId = learnerOf((await searchParams).learner);
  const attempts = learnerId ? await loadAttemptCount(learnerId, String(id)) : null;
  return <TicketArticle face={face} attempts={attempts} />;
}
