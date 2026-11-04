import type { TicketFace } from "@course/ticket-face.ts";

export function TicketArticle({ face }: { face: TicketFace }) {
  return (
    <article>
      <h1>{`Билет № ${face.id}`}</h1>
      <p>{face.question}</p>
      <ol>
        {face.options.map((option, index) => (
          <li key={index}>{option}</li>
        ))}
      </ol>
      <p>
        Хеш текста: <code>{face.hash}</code>
      </p>
      {face.original ? <p lang="ka">{face.original}</p> : null}
      {face.explanation ? (
        <section>
          <h2>Пояснение</h2>
          <p>Машинный перевод грузинского пояснения банка.</p>
          <p>{face.explanation}</p>
        </section>
      ) : null}
    </article>
  );
}
