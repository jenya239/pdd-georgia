import { Module } from "@nestjs/common";
import { AttemptJournal } from "./attempt-journal.ts";
import { TicketRelease } from "./ticket-release.ts";

@Module({ providers: [TicketRelease, AttemptJournal] })
export class AppModule {}
