-- CreateTable
CREATE TABLE "course_release" (
    "id" TEXT NOT NULL,
    "tickets" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "episodes" JSONB NOT NULL,
    "norms" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt" (
    "learner_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "ticket_key" TEXT NOT NULL,
    "t" BIGINT NOT NULL,
    "c" INTEGER,
    "ok" INTEGER NOT NULL,
    "w" TEXT,
    "hash" TEXT,

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("learner_id","id")
);

-- CreateIndex
CREATE INDEX "attempt_learner_id_ticket_key_t_idx" ON "attempt"("learner_id", "ticket_key", "t");
