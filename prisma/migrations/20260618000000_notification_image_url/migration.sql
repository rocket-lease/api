-- Optional image (e.g. the vehicle photo) shown alongside a notification in the
-- in-app center. Ignored by iOS web push, which renders only title and body.
ALTER TABLE "notifications"
    ADD COLUMN "image_url" TEXT;
