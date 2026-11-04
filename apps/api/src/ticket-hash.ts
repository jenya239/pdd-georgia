import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import { TicketRelease } from "./ticket-release.ts";

export async function ticketHash(id: number): Promise<string | null> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    return await app.get(TicketRelease).hashOf(id);
  } finally {
    await app.close();
  }
}
