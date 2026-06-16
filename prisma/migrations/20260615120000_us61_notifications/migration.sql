-- In-app notification center: every notification dispatched by the platform is
-- persisted here so the event survives even when web push is disabled.
CREATE TABLE "notifications" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    TEXT        NOT NULL,
    "title"      TEXT        NOT NULL,
    "body"       TEXT        NOT NULL,
    "url"        TEXT,
    "read_at"    TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at", "id");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
