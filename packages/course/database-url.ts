import { userInfo } from "node:os";

/** Local peer auth over the Postgres socket. DATABASE_URL overrides it. */
export const databaseUrl = () =>
  process.env.DATABASE_URL ?? `postgresql://${userInfo().username}@localhost/pdd_georgia?host=/var/run/postgresql`;
