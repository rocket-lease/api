-- US-05: phone verification stub
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
