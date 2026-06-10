-- El flag de administración pasa de la columna de texto "role" a un boolean
-- explícito "is_admin". IF EXISTS / IF NOT EXISTS hacen la migración
-- idempotente frente a entornos donde la columna ya fue creada por otra
-- migración o a mano.
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false;
