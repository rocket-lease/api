ALTER TABLE "search_logs"
  ADD COLUMN "signal" TEXT NOT NULL DEFAULT 'search';

CREATE INDEX "search_logs_signal_time_idx"
  ON "search_logs"("signal", "created_at" DESC);
