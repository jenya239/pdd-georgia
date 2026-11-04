import { defineConfig } from "prisma/config";
import { databaseUrl } from "./packages/course/database-url.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl() },
});
