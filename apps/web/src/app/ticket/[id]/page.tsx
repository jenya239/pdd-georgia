import { notFound } from "next/navigation";
import { parseTicketId } from "@course/ticket-face.ts";
import { loadTicketFace } from "../../../server/load-ticket.ts";
import { TicketArticle } from "../../../ticket/ticket-article.tsx";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseTicketId(raw);
  if (id === null) notFound();
  const face = await loadTicketFace(id);
  if (face === null) notFound();
  return <TicketArticle face={face} />;
}
