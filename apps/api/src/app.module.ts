import { Module } from "@nestjs/common";
import { TicketRelease } from "./ticket-release.ts";

@Module({ providers: [TicketRelease] })
export class AppModule {}
